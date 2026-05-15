/**
 * 耐力壁の記号（1, 2, 3..）に対して倍率を設定するためのモーダルUI
 */
export function showWallSymbolModal(symbols) {
    return new Promise((resolve) => {
        // すでに存在すれば削除
        if (window.safeRemoveById) window.safeRemoveById('wallSymbolModal');
        else {
            const existing = document.getElementById('wallSymbolModal');
            if (existing) existing.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'wallSymbolModal';
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: '3000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', sans-serif"
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            backgroundColor: '#181b22', width: '400px', padding: '24px',
            borderRadius: '12px', border: '1px solid #2d3140',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            color: '#e4e6ec'
        });

        const title = document.createElement('h3');
        title.textContent = '🧱 耐力壁倍率の設定';
        title.style.marginBottom = '8px';
        title.style.fontSize = '18px';
        content.appendChild(title);

        const desc = document.createElement('p');
        desc.textContent = '図面から見つかった記号ごとに倍率を入力してください。';
        desc.style.color = '#8d92a0';
        desc.style.fontSize = '12px';
        desc.style.marginBottom = '20px';
        content.appendChild(desc);

        const list = document.createElement('div');
        list.style.maxHeight = '300px';
        list.style.overflowY = 'auto';
        list.style.marginBottom = '20px';

        const mappingInputs = {};

        if (symbols.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = '耐力壁記号が見つかりませんでした。';
            empty.style.textAlign = 'center';
            empty.style.padding = '20px';
            list.appendChild(empty);
        } else {
            symbols.forEach(sym => {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '10px', padding: '8px', backgroundColor: '#252830',
                    borderRadius: '6px', border: '1px solid #2d3140'
                });

                const label = document.createElement('span');
                label.textContent = `記号: ${sym}`;
                label.style.fontWeight = 'bold';
                row.appendChild(label);

                const input = document.createElement('input');
                input.type = 'number';
                input.step = '0.1';
                input.value = '2.0'; // デフォルト
                input.style.width = '80px';
                input.style.padding = '4px 8px';
                input.style.backgroundColor = '#181b22';
                input.style.border = '1px solid #2d3140';
                input.style.borderRadius = '4px';
                input.style.color = '#fff';
                input.style.textAlign = 'right';
                row.appendChild(input);

                mappingInputs[sym] = input;
                list.appendChild(row);
            });
        }
        content.appendChild(list);

        const footer = document.createElement('div');
        footer.style.textAlign = 'right';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'キャンセル';
        Object.assign(cancelBtn.style, {
            background: 'none', border: 'none', color: '#8d92a0',
            marginRight: '16px', cursor: 'pointer', fontSize: '14px'
        });
        cancelBtn.onclick = () => {
            if (window.safeRemoveById) window.safeRemoveById('wallSymbolModal');
            else modal.remove();
            resolve(null);
        };

        const okBtn = document.createElement('button');
        okBtn.textContent = '設定を適用して読み込む';
        Object.assign(okBtn.style, {
            backgroundColor: '#5b8afe', color: '#fff', border: 'none',
            padding: '8px 24px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 'bold'
        });
        okBtn.onclick = () => {
            const result = {};
            for (const sym in mappingInputs) {
                result[sym] = parseFloat(mappingInputs[sym].value) || 0;
            }
            if (window.safeRemoveById) window.safeRemoveById('wallSymbolModal');
            else modal.remove();
            resolve(result);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(okBtn);
        content.appendChild(footer);

        modal.appendChild(content);
        document.body.appendChild(modal);
    });
}
