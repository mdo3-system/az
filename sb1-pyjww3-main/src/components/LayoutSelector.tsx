import React, { useState, useEffect } from 'react';
import { Layout, defaultLayout, a4_40_layout } from '../types/layout';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface LayoutSelectorProps {
  selectedLayout: Layout;
  onLayoutChange: (layout: Layout) => void;
}

const LayoutSelector: React.FC<LayoutSelectorProps> = ({ selectedLayout, onLayoutChange }) => {
  const [layouts, setLayouts] = useState<Layout[]>([defaultLayout, a4_40_layout]);

  useEffect(() => {
    const fetchLayouts = async () => {
      const layoutsCollection = collection(db, 'layouts');
      const layoutsSnapshot = await getDocs(layoutsCollection);
      const layoutsList = layoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Layout));
      setLayouts([defaultLayout, a4_40_layout, ...layoutsList]);
    };

    fetchLayouts();
  }, []);

  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Print Layout
      </label>
      <select
        value={selectedLayout.id}
        onChange={(e) => {
          const layout = layouts.find(l => l.id === e.target.value);
          if (layout) onLayoutChange(layout);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
      >
        {layouts.map((layout) => (
          <option key={layout.id} value={layout.id}>
            {layout.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LayoutSelector;