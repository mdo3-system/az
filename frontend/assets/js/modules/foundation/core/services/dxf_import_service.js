/**
 * dxf_import_service.js
 * 
 * DXF 読み込みフロー全体を管理する Service クラス
 * 依存関係を外部から注入（DI）してテスト可能にする
 */
import { parseDxfFile } from '../../foundation_dxf.js';
import { floorData, nextId, dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, setDxfData } from '../../foundation_cad.js';

export class DxfImportService {
  constructor(dependencies = {}) {
    this.parseDxfFile = dependencies.parseDxfFile || parseDxfFile;
    this.floorData = dependencies.floorData || floorData;
    this.setDxfData = dependencies.setDxfData || setDxfData;
  }

  /**
   * 統合された複数階のDXFファイルをパースして適用する
   * @param {File} mergedFile
   * @returns {Promise<string[]>} layerNames
   */
  async importMergedFloors(mergedFile) {
    console.log('[DxfImportService] importMergedFloors 開始');
    const layerNames = await this.parseDxfFile(mergedFile, false, null);
    console.log('[DxfImportService] importMergedFloors 完了');
    return layerNames;
  }
}
