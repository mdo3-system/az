import React from 'react';
import SingleLabel from './SingleLabel';
import type { Layout } from '../types/layout';

interface LabelGridProps {
  barcodes: Array<{ url: string; text: string }>;
  startPosition: number;
  layout: Layout;
}

const LabelGrid: React.FC<LabelGridProps> = ({ barcodes, startPosition, layout }) => {
  // Calculate how many pages we need
  const totalPages = Math.ceil(barcodes.length / layout.totalBoxes);
  const pages = Array(totalPages).fill(null);

  return (
    <div className="flex flex-col gap-8">
      {pages.map((_, pageIndex) => {
        const pageStart = pageIndex * layout.totalBoxes;
        const pageBarcodes = barcodes.slice(pageStart, pageStart + layout.totalBoxes);
        const cells = Array(layout.totalBoxes).fill(null);

        // Fill cells for this page
        pageBarcodes.forEach((barcode, index) => {
          cells[index] = barcode;
        });

        return (
          <div 
            key={pageIndex}
            className="relative bg-white page-break-after-always"
            style={{
              width: `${layout.pageWidth}mm`,
              height: `${layout.pageHeight}mm`
            }}
          >
            <div 
              className="absolute grid"
              style={{
                top: `${layout.marginTop}mm`,
                right: `${layout.marginRight}mm`,
                bottom: `${layout.marginBottom}mm`,
                left: `${layout.marginLeft}mm`,
                gridTemplateColumns: `repeat(${layout.boxesHorizontal}, ${layout.boxWidth}mm)`,
                gridTemplateRows: `repeat(${layout.boxesVertical}, ${layout.boxHeight}mm)`,
                gap: `${layout.verticalGap}mm ${layout.horizontalGap}mm`
              }}
            >
              {cells.map((barcode, index) => (
                <SingleLabel
                  key={index}
                  barcodeUrl={barcode?.url}
                  barcodeText={barcode?.text}
                  width={layout.boxWidth}
                  height={layout.boxHeight}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LabelGrid;