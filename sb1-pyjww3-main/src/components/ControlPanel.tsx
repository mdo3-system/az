import React from 'react';
import { Share2, RotateCw, Wand2, Clipboard, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import LayoutSelector from './LayoutSelector';
import { Layout } from '../types/layout';

interface ControlPanelProps {
  barcodeText: string;
  setBarcodeText: (text: string) => void;
  barcodeCount: string;
  setBarcodeCount: (count: string) => void;
  startPosition: string;
  setStartPosition: (position: string) => void;
  selectedLayout: Layout;
  onLayoutChange: (layout: Layout) => void;
  onReset: () => void;
  onGeneratePDF: () => void;
  hasContent: boolean;
  onGenerateBarcode: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  barcodeText,
  setBarcodeText,
  barcodeCount,
  setBarcodeCount,
  startPosition,
  setStartPosition,
  selectedLayout,
  onLayoutChange,
  onReset,
  onGeneratePDF,
  hasContent,
  onGenerateBarcode,
  showAdvanced,
  setShowAdvanced
}) => {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBarcodeText(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(barcodeText);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-10">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Barcode Printing | Discount Bazaar 99</h1>
        <div className="flex flex-col space-y-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Barcode Text
            </label>
            <div className="relative flex items-center">
              {!barcodeText && (
                <button
                  onClick={handlePaste}
                  className="absolute left-2 text-gray-400 hover:text-indigo-600"
                  title="Paste from clipboard"
                >
                  <Clipboard className="h-5 w-5" />
                </button>
              )}
              <input
                type="text"
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 ${
                  !barcodeText ? 'pl-10' : ''
                } pr-20`}
                placeholder="Enter text for barcode"
              />
              <div className="absolute right-2 flex space-x-2">
                {barcodeText && (
                  <button
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-indigo-600"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={onGenerateBarcode}
                  className="text-gray-400 hover:text-indigo-600"
                  title="Generate unique barcode"
                >
                  <Wand2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LayoutSelector
              selectedLayout={selectedLayout}
              onLayoutChange={onLayoutChange}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Position
                </label>
                <input
                  type="text"
                  value={startPosition}
                  onChange={(e) => setStartPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Labels
                </label>
                <input
                  type="text"
                  value={barcodeCount}
                  onChange={(e) => setBarcodeCount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-between items-center">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 mr-2" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Advanced Editor
            </button>
            <div className="flex gap-2">
              <button
                onClick={onReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Reset
              </button>
              <button
                onClick={onGeneratePDF}
                disabled={!hasContent}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;