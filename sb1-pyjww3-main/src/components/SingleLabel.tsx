import React from 'react';

interface SingleLabelProps {
  barcodeUrl?: string;
  barcodeText?: string;
  width: number;
  height: number;
}

const SingleLabel: React.FC<SingleLabelProps> = ({ barcodeUrl, barcodeText, width, height }) => {
  return (
    <div 
      className="flex flex-col items-center justify-center p-3"
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        boxSizing: 'border-box'
      }}
    >
      {barcodeUrl && (
        <div className="w-full flex flex-col items-center justify-center space-y-0.5">
          <span className="text-xs font-medium text-gray-700">{barcodeText}</span>
          <img 
            src={barcodeUrl}
            alt="Barcode"
            style={{
              maxWidth: `${width - 6}mm`,
              maxHeight: `${height - 12}mm`,
              objectFit: 'contain'
            }}
          />
          <span className="text-[10px] text-gray-500">discountbazaar99.com</span>
        </div>
      )}
    </div>
  );
};

export default SingleLabel;