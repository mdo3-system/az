import json
with open("test_calc_nan.js", "w") as f:
    f.write("""
var a = parseFloat("");
console.log(a);
var b = a * 1.0;
console.log(b);
""")
