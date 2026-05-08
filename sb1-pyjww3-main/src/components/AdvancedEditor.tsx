import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface AdvancedEditorProps {
  barcodes: Array<{ text: string; count: string }>;
  setBarcodes: React.Dispatch<React.SetStateAction<Array<{ text: string; count: string }>>>;
}

const AdvancedEditor: React.FC<AdvancedEditorProps> = ({ barcodes, setBarcodes }) => {
  const addBarcode = () => {
    setBarcodes([...barcodes, { text: '', count: '1' }]);
  };

  const removeBarcode = (index: number) => {
    setBarcodes(barcodes.filter((_, i) => i !== index));
  };

  const updateBarcode = (index: number, field: 'text' | 'count', value: string) => {
    const newBarcodes = [...barcodes];
    newBarcodes[index] = {
      ...newBarcodes[index],
      [field]: value
    };
    setBarcodes(newBarcodes);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Advanced Barcode Editor</h2>
      <div className="space-y-4">
        {barcodes.map((barcode, index) => (
          <div key={index} className="flex gap-4 items-start">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barcode Text {index + 1}
              </label>
              <input
                type="text"
                value={barcode.text}
                onChange={(e) => updateBarcode(index, 'text', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Count
              </label>
              <input
                type="text"
                value={barcode.count}
                onChange={(e) => updateBarcode(index, 'count', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => removeBarcode(index)}
              className="mt-7 p-2 text-red-600 hover:text-red-800"
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>
        ))}
        <button
          onClick={addBarcode}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Barcode Set
        </button>
      </div>
    </div>
  );
};

export default AdvancedEditor;