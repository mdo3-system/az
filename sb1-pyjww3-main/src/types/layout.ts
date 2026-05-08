export interface Layout {
  id: string;
  name: string;
  pageHeight: number;
  pageWidth: number;
  orientation: 'horizontal' | 'vertical';
  boxesVertical: number;
  boxesHorizontal: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  boxWidth: number;
  boxHeight: number;
  verticalGap: number;
  horizontalGap: number;
  totalBoxes: number;
}

export const defaultLayout: Layout = {
  id: 'default-a4-24',
  name: 'A4 24 Labels (3x8)',
  pageHeight: 297,
  pageWidth: 210,
  orientation: 'horizontal',
  boxesVertical: 8,
  boxesHorizontal: 3,
  marginTop: 8.5,
  marginBottom: 7.5, // Adjusted to compensate for vertical gaps
  marginLeft: 3.5,
  marginRight: 3.5,
  boxWidth: 64,
  boxHeight: 34,
  verticalGap: 1, // Added 1mm vertical gap
  horizontalGap: 2.5,
  totalBoxes: 24
};

export const a4_40_layout: Layout = {
  id: 'a4-40-labels',
  name: 'A4 40 Labels (4x10)',
  pageHeight: 297,
  pageWidth: 210,
  orientation: 'horizontal',
  boxesVertical: 10,
  boxesHorizontal: 4,
  marginTop: 2,
  marginBottom: 2,
  marginLeft: 2,
  marginRight: 2,
  boxWidth: 49.5, // First and last columns
  boxHeight: 29.7, // Middle rows
  verticalGap: 0,
  horizontalGap: 0,
  totalBoxes: 40
};