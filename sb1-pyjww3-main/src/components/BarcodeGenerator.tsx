import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import html2pdf from 'html2pdf.js';
import LabelGrid from './LabelGrid';
import ControlPanel from './ControlPanel';
import AdvancedEditor from './AdvancedEditor';
import { defaultLayout } from '../types/layout';
import type { Layout } from '../types/layout';

const BarcodeGenerator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [barcodeText, setBarcodeText] = useState('');
  const [barcodeCount, setBarcodeCount] = useState<string>(defaultLayout.totalBoxes.toString());
  const [startPosition, setStartPosition] = useState<string>('1');
  const [selectedLayout, setSelectedLayout] = useState<Layout>(defaultLayout);
  const [barcodes, setBarcodes] = useState<Array<{ url: string; text: string }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedBarcodes, setAdvancedBarcodes] = useState<Array<{ text: string; count: string }>>([]);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const barcodeParam = searchParams.get('barcode');
    if (barcodeParam) {
      setBarcodeText(barcodeParam);
    }

    if ('clipboard' in navigator && 'readText' in navigator.clipboard) {
      navigator.clipboard.readText()
        .then(text => {
          if (text && !barcodeParam) {
            setBarcodeText(text);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    if (barcodeText && !showAdvanced) {
      const canvas = document.createElement('canvas');
      try {
        JsBarcode(canvas, barcodeText, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: false,
          margin: 5,
          background: '#ffffff'
        });
        const barcodeUrl = canvas.toDataURL('image/png');
        const count = parseInt(barcodeCount) || 0;
        const start = Math.max(0, (parseInt(startPosition) || 1) - 1);
        const emptySlots = Array(start).fill(null);
        const filledBarcodes = Array(count).fill({ url: barcodeUrl, text: barcodeText });
        setBarcodes([...emptySlots, ...filledBarcodes]);
      } catch (error) {
        console.error('Invalid barcode text');
      }
    }
  }, [barcodeText, barcodeCount, startPosition, showAdvanced]);

  useEffect(() => {
    if (showAdvanced && advancedBarcodes.length > 0) {
      const newBarcodes: Array<{ url: string; text: string }> = [];
      advancedBarcodes.forEach(({ text, count }) => {
        if (text) {
          const canvas = document.createElement('canvas');
          try {
            JsBarcode(canvas, text, {
              format: 'CODE128',
              width: 2,
              height: 80,
              displayValue: false,
              margin: 5,
              background: '#ffffff'
            });
            const barcodeUrl = canvas.toDataURL('image/png');
            const repeatCount = parseInt(count) || 0;
            newBarcodes.push(...Array(repeatCount).fill({ url: barcodeUrl, text }));
          } catch (error) {
            console.error('Invalid barcode text:', text);
          }
        }
      });
      setBarcodes(newBarcodes);
    }
  }, [advancedBarcodes, showAdvanced]);

  const generateUniqueBarcode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const randomLetters = Array(3)
      .fill(null)
      .map(() => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
      .join('');
    setBarcodeText(`${timestamp}${randomNum}${randomLetters}`);
  };

  const generatePDF = () => {
    if (!pageRef.current) return;

    const opt = {
      filename: `[${barcodeText}][${selectedLayout.name}].pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(pageRef.current).save();
  };

  const handleReset = () => {
    setBarcodeText('');
    setBarcodeCount(selectedLayout.totalBoxes.toString());
    setStartPosition('1');
    setBarcodes([]);
    setAdvancedBarcodes([]);
  };

  const handleLayoutChange = (layout: Layout) => {
    setSelectedLayout(layout);
    setBarcodeCount(layout.totalBoxes.toString());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ControlPanel
        barcodeText={barcodeText}
        setBarcodeText={setBarcodeText}
        barcodeCount={barcodeCount}
        setBarcodeCount={setBarcodeCount}
        startPosition={startPosition}
        setStartPosition={setStartPosition}
        selectedLayout={selectedLayout}
        onLayoutChange={handleLayoutChange}
        onReset={handleReset}
        onGeneratePDF={generatePDF}
        hasContent={barcodes.length > 0}
        onGenerateBarcode={generateUniqueBarcode}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
      />

      {showAdvanced && (
        <div className="pt-4 px-4">
          <div className="max-w-7xl mx-auto">
            <AdvancedEditor
              barcodes={advancedBarcodes}
              setBarcodes={setAdvancedBarcodes}
            />
          </div>
        </div>
      )}

      <div className="pt-24 pb-8 px-4">
        <div className="max-w-[210mm] mx-auto bg-white shadow-lg">
          <div ref={pageRef}>
            <LabelGrid 
              barcodes={barcodes}
              startPosition={0}
              layout={selectedLayout}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenerator;