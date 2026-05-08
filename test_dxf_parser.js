const DxfParser = require('dxf-parser');
const fs = require('fs');

try {
    const fileContent = fs.readFileSync('merged_structure.dxf', 'utf-8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(fileContent);
    const lines = dxf.entities.filter(e => e.type === 'LINE');
    console.log("Found", lines.length, "lines.");
    if (lines.length > 0) {
        console.log("First line:", JSON.stringify(lines[0]));
    }
} catch (err) {
    console.error("Failed to parse DXF:");
    console.error(err);
}
