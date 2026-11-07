# scratch/generate_wasm.py
"""
WebAssembly (Wasm) Binary Generator for AZ Structural CAD
幾何計算・高速判定コアをWebAssemblyバイナリ (.wasm) として生成するスクリプト。
外部ツールチェーンに依存せず、標準Pythonのみで自己完結してWASMバイナリを構築します。
"""
import struct
import os

def leb128_u(val):
    res = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val != 0:
            b |= 0x80
        res.append(b)
        if val == 0:
            break
    return bytes(res)

def leb128_s(val):
    res = bytearray()
    more = True
    while more:
        b = val & 0x7F
        val >>= 7
        sign_bit = (b & 0x40) != 0
        if (val == 0 and not sign_bit) or (val == -1 and sign_bit):
            more = False
        else:
            b |= 0x80
        res.append(b)
    return bytes(res)

def encode_vector(items):
    return leb128_u(len(items)) + b''.join(items)

def encode_section(sec_id, payload):
    return bytes([sec_id]) + leb128_u(len(payload)) + payload

# WASM Type Constants
F64 = 0x7C
F32 = 0x7D
I64 = 0x7E
I32 = 0x7F
VOID = 0x40

# Opcodes
OP_LOCAL_GET = 0x20
OP_LOCAL_SET = 0x21
OP_F64_LOAD = 0x2B
OP_I32_CONST = 0x41
OP_F64_CONST = 0x44
OP_I32_EQ = 0x46
OP_I32_LT_S = 0x48
OP_F64_LT = 0x63
OP_F64_GT = 0x64
OP_I32_ADD = 0x6A
OP_I32_SUB = 0x6B
OP_I32_MUL = 0x6C
OP_I32_AND = 0x71
OP_I32_XOR = 0x73
OP_F64_ABS = 0x99
OP_F64_SQRT = 0x9F
OP_F64_ADD = 0xA0
OP_F64_SUB = 0xA1
OP_F64_MUL = 0xA2
OP_F64_DIV = 0xA3
OP_F64_MIN = 0xA4
OP_F64_MAX = 0xA5
OP_LOOP = 0x03
OP_IF = 0x04
OP_ELSE = 0x05
OP_END = 0x0B
OP_BR_IF = 0x0D
OP_RETURN = 0x0F
OP_CALL = 0x10

def make_func_type(params, returns):
    return bytes([0x60]) + encode_vector([bytes([p]) for p in params]) + encode_vector([bytes([r]) for r in returns])

def f64_c(val):
    return bytes([OP_F64_CONST]) + struct.pack('<d', float(val))

def i32_c(val):
    return bytes([OP_I32_CONST]) + leb128_s(int(val))

def build_wasm():
    # 1. Type Section
    # Type 0: (f64, f64, f64, f64, f64, f64, f64, f64, f64) -> i32 (check_collinear)
    # Type 1: (f64, f64) -> f64 (fast_hypot: sqrt(dx^2 + dy^2))
    # Type 2: (i32, i32) -> f64 (calc_polygon_area: ptr, count -> area)
    # Type 3: (f64, f64, f64, f64, f64, f64) -> f64 (point_to_line_segment_dist)
    # Type 4: (f64, f64, i32, i32) -> i32 (point_in_polygon: px, py, ptr, count -> 0/1)
    types = [
        make_func_type([F64]*9, [I32]),       # 0: check_collinear
        make_func_type([F64, F64], [F64]),    # 1: fast_hypot
        make_func_type([I32, I32], [F64]),    # 2: calc_polygon_area
        make_func_type([F64]*6, [F64]),       # 3: point_to_segment_dist
        make_func_type([F64, F64, I32, I32], [I32]), # 4: point_in_polygon
    ]
    type_section = encode_section(1, encode_vector(types))

    # 2. Function Section: maps func index to type index
    func_types = [0, 1, 2, 3, 4]
    func_section = encode_section(3, encode_vector([leb128_u(t) for t in func_types]))

    # 3. Memory Section: 1 page (64KB), max 16 pages
    memory = bytes([0x01, 0x01]) + leb128_u(16)
    mem_section = encode_section(5, encode_vector([memory]))

    # 4. Export Section
    def make_export(name, kind, index):
        return leb128_u(len(name)) + name + bytes([kind]) + leb128_u(index)
    
    export_items = [
        make_export(b"memory", 0x02, 0),
        make_export(b"check_collinear", 0x00, 0),
        make_export(b"fast_hypot", 0x00, 1),
        make_export(b"calc_polygon_area", 0x00, 2),
        make_export(b"point_to_segment_dist", 0x00, 3),
        make_export(b"point_in_polygon", 0x00, 4),
    ]
    export_section = encode_section(7, encode_vector(export_items))

    # 5. Code Section
    # --- Func 0: check_collinear(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, eps) -> i32 ---
    # area1 = abs((p2x - p1x)*(p3y - p1y) - (p2y - p1y)*(p3x - p1x))
    # area2 = abs((p2x - p1x)*(p4y - p1y) - (p2y - p1y)*(p4x - p1x))
    # limit = eps * 1000.0
    # return (area1 < limit) && (area2 < limit)
    f0_locals = encode_vector([])
    f0_code = bytearray()
    # (p2x - p1x)*(p3y - p1y)
    f0_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 0, OP_F64_SUB])
    f0_code += bytes([OP_LOCAL_GET, 5, OP_LOCAL_GET, 1, OP_F64_SUB])
    f0_code += bytes([OP_F64_MUL])
    # (p2y - p1y)*(p3x - p1x)
    f0_code += bytes([OP_LOCAL_GET, 3, OP_LOCAL_GET, 1, OP_F64_SUB])
    f0_code += bytes([OP_LOCAL_GET, 4, OP_LOCAL_GET, 0, OP_F64_SUB])
    f0_code += bytes([OP_F64_MUL])
    f0_code += bytes([OP_F64_SUB, OP_F64_ABS])
    # eps * 1000.0
    f0_code += bytes([OP_LOCAL_GET, 8]) + f64_c(1000.0) + bytes([OP_F64_MUL])
    f0_code += bytes([OP_F64_LT]) # area1 < limit

    # area2
    f0_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 0, OP_F64_SUB])
    f0_code += bytes([OP_LOCAL_GET, 7, OP_LOCAL_GET, 1, OP_F64_SUB])
    f0_code += bytes([OP_F64_MUL])
    f0_code += bytes([OP_LOCAL_GET, 3, OP_LOCAL_GET, 1, OP_F64_SUB])
    f0_code += bytes([OP_LOCAL_GET, 6, OP_LOCAL_GET, 0, OP_F64_SUB])
    f0_code += bytes([OP_F64_MUL])
    f0_code += bytes([OP_F64_SUB, OP_F64_ABS])
    f0_code += bytes([OP_LOCAL_GET, 8]) + f64_c(1000.0) + bytes([OP_F64_MUL])
    f0_code += bytes([OP_F64_LT]) # area2 < limit

    f0_code += bytes([OP_I32_AND, OP_END])
    func0 = leb128_u(len(f0_locals) + len(f0_code)) + f0_locals + bytes(f0_code)

    # --- Func 1: fast_hypot(dx, dy) -> sqrt(dx*dx + dy*dy) ---
    f1_locals = encode_vector([])
    f1_code = bytearray()
    f1_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 0, OP_F64_MUL])
    f1_code += bytes([OP_LOCAL_GET, 1, OP_LOCAL_GET, 1, OP_F64_MUL])
    f1_code += bytes([OP_F64_ADD, OP_F64_SQRT, OP_END])
    func1 = leb128_u(len(f1_locals) + len(f1_code)) + f1_locals + bytes(f1_code)

    # --- Func 2: calc_polygon_area(ptr: i32, count: i32) -> f64 ---
    # Shoelace formula: 0.5 * abs(sum_{i=0}^{count-1} (x_i * y_{next} - x_{next} * y_i))
    # locals: 2: i (i32), 3: accum_area (f64), 4: next_i (i32)
    f2_locals = encode_vector([
        leb128_u(1) + bytes([I32]), # local 2: i
        leb128_u(1) + bytes([F64]), # local 3: accum_area
        leb128_u(1) + bytes([I32]), # local 4: next_i
    ])
    f2_code = bytearray()
    # if count < 3 return 0.0
    f2_code += bytes([OP_LOCAL_GET, 1]) + i32_c(3) + bytes([OP_I32_LT_S, OP_IF, VOID])
    f2_code += f64_c(0.0) + bytes([OP_RETURN, OP_END])

    # loop
    f2_code += bytes([OP_LOOP, VOID])
    # next_i = (i + 1 == count) ? 0 : i + 1
    f2_code += bytes([OP_LOCAL_GET, 2]) + i32_c(1) + bytes([OP_I32_ADD, OP_LOCAL_GET, 1, OP_I32_EQ])
    f2_code += bytes([OP_IF, I32]) + i32_c(0) + bytes([OP_ELSE, OP_LOCAL_GET, 2]) + i32_c(1) + bytes([OP_I32_ADD, OP_END])
    f2_code += bytes([OP_LOCAL_SET, 4]) # local.set 4 (next_i)

    # term1: x_i * y_next
    # load x_i:
    f2_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 2]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD])
    f2_code += bytes([OP_F64_LOAD, 0x03, 0x00]) # align=3, offset=0
    # load y_next:
    f2_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 4]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD])
    f2_code += bytes([OP_F64_LOAD, 0x03, 0x08]) # align=3, offset=8
    f2_code += bytes([OP_F64_MUL])

    # term2: x_next * y_i
    f2_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 4]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD])
    f2_code += bytes([OP_F64_LOAD, 0x03, 0x00])
    f2_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 2]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD])
    f2_code += bytes([OP_F64_LOAD, 0x03, 0x08])
    f2_code += bytes([OP_F64_MUL])

    # term1 - term2 + accum_area
    f2_code += bytes([OP_F64_SUB, OP_LOCAL_GET, 3, OP_F64_ADD, OP_LOCAL_SET, 3])

    # i++
    f2_code += bytes([OP_LOCAL_GET, 2]) + i32_c(1) + bytes([OP_I32_ADD, OP_LOCAL_SET, 2])
    # if i < count continue loop
    f2_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 1, OP_I32_LT_S, OP_BR_IF, 0, OP_END]) # end loop

    # return abs(accum_area) * 0.5
    f2_code += bytes([OP_LOCAL_GET, 3, OP_F64_ABS]) + f64_c(0.5) + bytes([OP_F64_MUL, OP_END])
    func2 = leb128_u(len(f2_locals) + len(f2_code)) + f2_locals + bytes(f2_code)

    # --- Func 3: point_to_segment_dist(px, py, x1, y1, x2, y2) -> f64 ---
    # locals: 6: dx, 7: dy, 8: len_sq, 9: t
    f3_locals = encode_vector([
        leb128_u(4) + bytes([F64]), # 6..9
    ])
    f3_code = bytearray()
    # dx = x2 - x1
    f3_code += bytes([OP_LOCAL_GET, 4, OP_LOCAL_GET, 2, OP_F64_SUB, OP_LOCAL_SET, 6])
    # dy = y2 - y1
    f3_code += bytes([OP_LOCAL_GET, 5, OP_LOCAL_GET, 3, OP_F64_SUB, OP_LOCAL_SET, 7])
    # len_sq = dx*dx + dy*dy
    f3_code += bytes([OP_LOCAL_GET, 6, OP_LOCAL_GET, 6, OP_F64_MUL])
    f3_code += bytes([OP_LOCAL_GET, 7, OP_LOCAL_GET, 7, OP_F64_MUL, OP_F64_ADD, OP_LOCAL_SET, 8])

    # if len_sq < 1e-12
    f3_code += bytes([OP_LOCAL_GET, 8]) + f64_c(1e-12) + bytes([OP_F64_LT, OP_IF, VOID])
    f3_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 2, OP_F64_SUB])
    f3_code += bytes([OP_LOCAL_GET, 1, OP_LOCAL_GET, 3, OP_F64_SUB])
    f3_code += bytes([OP_CALL, 1, OP_RETURN, OP_END])

    # t = ((px - x1)*dx + (py - y1)*dy) / len_sq
    f3_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 2, OP_F64_SUB, OP_LOCAL_GET, 6, OP_F64_MUL])
    f3_code += bytes([OP_LOCAL_GET, 1, OP_LOCAL_GET, 3, OP_F64_SUB, OP_LOCAL_GET, 7, OP_F64_MUL, OP_F64_ADD])
    f3_code += bytes([OP_LOCAL_GET, 8, OP_F64_DIV])
    # clamp: max(0.0, min(1.0, t))
    f3_code += f64_c(1.0) + bytes([OP_F64_MIN])
    f3_code += f64_c(0.0) + bytes([OP_F64_MAX, OP_LOCAL_SET, 9])

    # proj_x = x1 + t*dx, proj_y = y1 + t*dy
    # dist = hypot(px - proj_x, py - proj_y)
    f3_code += bytes([OP_LOCAL_GET, 0, OP_LOCAL_GET, 2, OP_LOCAL_GET, 9, OP_LOCAL_GET, 6, OP_F64_MUL, OP_F64_ADD, OP_F64_SUB])
    f3_code += bytes([OP_LOCAL_GET, 1, OP_LOCAL_GET, 3, OP_LOCAL_GET, 9, OP_LOCAL_GET, 7, OP_F64_MUL, OP_F64_ADD, OP_F64_SUB])
    f3_code += bytes([OP_CALL, 1, OP_END])
    func3 = leb128_u(len(f3_locals) + len(f3_code)) + f3_locals + bytes(f3_code)

    # --- Func 4: point_in_polygon(px: f64, py: f64, ptr: i32, count: i32) -> i32 (0 or 1) ---
    # locals: 4: inside (i32), 5: i (i32), 6: j (i32)
    f4_locals = encode_vector([
        leb128_u(3) + bytes([I32]), # 4, 5, 6
    ])
    f4_code = bytearray()
    # j = count - 1
    f4_code += bytes([OP_LOCAL_GET, 3]) + i32_c(1) + bytes([OP_I32_SUB, OP_LOCAL_SET, 6])
    # i = 0 (default 0), inside = 0 (default 0)

    # loop
    f4_code += bytes([OP_LOOP, VOID])
    # yi = load(ptr + i*16 + 8)
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 5]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x08])
    f4_code += bytes([OP_LOCAL_GET, 1, OP_F64_GT]) # yi > py
    # yj = load(ptr + j*16 + 8)
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 6]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x08])
    f4_code += bytes([OP_LOCAL_GET, 1, OP_F64_GT]) # yj > py
    f4_code += bytes([OP_I32_XOR]) # (yi > py) != (yj > py)

    f4_code += bytes([OP_IF, VOID])
    # check: px < (xj - xi) * (py - yi) / (yj - yi) + xi
    f4_code += bytes([OP_LOCAL_GET, 0]) # px

    # (xj - xi):
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 6]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x00]) # xj
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 5]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x00]) # xi
    f4_code += bytes([OP_F64_SUB])
    # * (py - yi):
    f4_code += bytes([OP_LOCAL_GET, 1])
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 5]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x08]) # yi
    f4_code += bytes([OP_F64_SUB, OP_F64_MUL])
    # / (yj - yi):
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 6]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x08]) # yj
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 5]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x08]) # yi
    f4_code += bytes([OP_F64_SUB, OP_F64_DIV])
    # + xi
    f4_code += bytes([OP_LOCAL_GET, 2, OP_LOCAL_GET, 5]) + i32_c(16) + bytes([OP_I32_MUL, OP_I32_ADD, OP_F64_LOAD, 0x03, 0x00, OP_F64_ADD])
    f4_code += bytes([OP_F64_LT])

    # if px < ... toggle inside: inside = 1 - inside
    f4_code += bytes([OP_IF, VOID]) + i32_c(1) + bytes([OP_LOCAL_GET, 4, OP_I32_SUB, OP_LOCAL_SET, 4, OP_END])
    f4_code += bytes([OP_END]) # end outer if

    # j = i
    f4_code += bytes([OP_LOCAL_GET, 5, OP_LOCAL_SET, 6])
    # i++
    f4_code += bytes([OP_LOCAL_GET, 5]) + i32_c(1) + bytes([OP_I32_ADD, OP_LOCAL_SET, 5])
    # loop condition: i < count
    f4_code += bytes([OP_LOCAL_GET, 5, OP_LOCAL_GET, 3, OP_I32_LT_S, OP_BR_IF, 0, OP_END])

    f4_code += bytes([OP_LOCAL_GET, 4, OP_END])
    func4 = leb128_u(len(f4_locals) + len(f4_code)) + f4_locals + bytes(f4_code)

    code_section = encode_section(10, encode_vector([func0, func1, func2, func3, func4]))

    wasm_bytes = b'\x00asm\x01\x00\x00\x00' + type_section + func_section + mem_section + export_section + code_section
    return wasm_bytes

if __name__ == '__main__':
    data = build_wasm()
    out_dir = r"frontend/assets/wasm"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "az_geometry.wasm")
    with open(out_path, "wb") as f:
        f.write(data)
    print(f"Generated {out_path} ({len(data)} bytes)")
