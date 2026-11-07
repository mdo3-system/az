import runner from '../test_runner.js';
import { DxfImportService } from '../services/dxf_import_service.js';
import { ProjectService } from '../services/project_service.js';

runner.test('DxfImportService: constructor and DI verification', async (t) => {
  let calledParse = false;
  let calledMultiParse = false;
  const mockParseDxfFile = async (file, keepExisting, symbolMap) => {
    calledParse = true;
    return ['LAYER1', 'LAYER2'];
  };
  const mockParseMultipleDxfFiles = async (filesByFloor, keepExisting, symbolMap) => {
    calledMultiParse = true;
    return ['GLID', 'COL_1F', 'COL_2F'];
  };

  const service = new DxfImportService({
    parseDxfFile: mockParseDxfFile,
    parseMultipleDxfFiles: mockParseMultipleDxfFiles
  });

  const dummyFile = new File([''], 'test.dxf', { type: 'application/dxf' });
  const layers = await service.importMergedFloors(dummyFile);

  t.assertEquals(calledParse, true, 'Mock parseDxfFile was called');
  t.assertEquals(layers.length, 2, 'Returned layer count matches');
  t.assertEquals(layers[0], 'LAYER1', 'Layer matches');

  const multiLayers = await service.importMultipleFloors({ '1F': dummyFile, '2F': dummyFile });
  t.assertEquals(calledMultiParse, true, 'Mock parseMultipleDxfFiles was called');
  t.assertEquals(multiLayers.length, 3, 'Returned multi-floor layer count matches');
  t.assertEquals(multiLayers[0], 'GLID', 'Multi-floor GLID layer matches');
});

runner.test('ProjectService: export and import verification', async (t) => {
  const mockFloorData = {
    '1': { nodes: [], columns: [], beams: [], slabs: [], walls: [], diaphragms: [], dxfLines: [], dxfTexts: [] }
  };
  let calledUpdateId = false;
  const mockUpdateNextId = (id) => {
    calledUpdateId = true;
  };

  const service = new ProjectService({
    floorData: mockFloorData,
    updateNextId: mockUpdateNextId,
    setDxfData: () => {},
    setFloor: () => {},
    pushHistory: () => {}
  });

  const jsonStr = service.exportProject({ '1': true });
  const parsed = JSON.parse(jsonStr);

  t.assertEquals(typeof parsed.floorData, 'object', 'floorData exported');
  
  // Test import
  parsed.nextId = 100;
  await service.importProject(parsed);
  t.assertEquals(calledUpdateId, true, 'mockUpdateNextId called on import');
});
