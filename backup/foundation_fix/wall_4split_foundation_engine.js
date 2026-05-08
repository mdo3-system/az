// [基礎梁計算Step1 応力耐力エンジン]

/**
 * ARCHITREND準拠の計算ロジックに基づき、基礎梁のスパン別諸元を算出・格納する
 * @param {object} beam - 基礎梁オブジェクト
 * @param {object} fd - 階層データ
 */
export function calculateArchitrendBeamStress(beam, fd) {
    if (!beam || !beam.spans) return;

    beam.spans.forEach((span, i) => {
        // 1. 基本寸法の取得
        const D = span.D || beam.depth || 600;
        const b = span.b || beam.width || 300;
        const dt = span.dt || 70;

        // 2. 有効高さ d & 応力中心距離 j の算出
        const d = D - dt;
        const j = 0.875 * d; // 7/8d

        // 諸元の格納
        span.d = d;
        span.j = j;
        span.b = b;
        span.D = D;
        span.dt = dt;

        // 3. 応力組合せロジック (長期 + 短期)
        // 長期応力 (Long term)
        const M_long = Math.abs(span.M_long || 0); // 既に計算済みの長期モーメント
        const Q_long = Math.abs(span.Q_long || 0); // 既に計算済みの長期せん断力

        // 短期応力 (Short term - 地震時など)
        // resL, resR などの地震時計算結果から最大値を取る想定
        const M_short = Math.max(Math.abs(span.M_short_L || 0), Math.abs(span.M_short_R || 0));
        const Q_short = Math.max(Math.abs(span.Q_short_L || 0), Math.abs(span.Q_short_R || 0));

        // 組合せ応力 (kN・m, kN)
        span.M_comb = M_long + M_short;
        span.Q_comb = Q_long + Q_short;

        // 4. せん断スパン比係数 α の算出
        // α = 4 / (M / (Q * d) + 1)  ※ d はメートル換算
        const d_m = d / 1000;
        const M_val = span.M_comb || 0.1;
        const Q_val = span.Q_comb || 0.1;
        
        let alpha = 4 / (M_val / (Q_val * d_m + 0.001) + 1);
        // 1.0 ≦ α ≦ 2.0 でクランプ
        span.alpha = Math.max(1.0, Math.min(2.0, alpha));
    });
}
