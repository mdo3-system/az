import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Layout } from '../types/layout';

const LayoutEditor: React.FC = () => {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<Partial<Layout>>({
    name: '',
    pageHeight: 297,
    pageWidth: 210,
    orientation: 'horizontal',
    boxesVertical: 7,
    boxesHorizontal: 3,
    marginTop: 15,
    marginBottom: 16,
    marginLeft: 8,
    marginRight: 8,
    boxWidth: 63.5,
    boxHeight: 38.1,
    verticalGap: 2.5,
    horizontalGap: 2.5
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalBoxes = layout.boxesVertical! * layout.boxesHorizontal!;
      const layoutData = {
        ...layout,
        totalBoxes
      };
      await addDoc(collection(db, 'layouts'), layoutData);
      navigate('/');
    } catch (error) {
      console.error('Error saving layout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Layout</h1>
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
          <div>
            <label className="block text-sm font-medium text-gray-700">Layout Name</label>
            <input
              type="text"
              value={layout.name}
              onChange={(e) => setLayout({ ...layout, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Page Height (mm)</label>
              <input
                type="number"
                value={layout.pageHeight}
                onChange={(e) => setLayout({ ...layout, pageHeight: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Page Width (mm)</label>
              <input
                type="number"
                value={layout.pageWidth}
                onChange={(e) => setLayout({ ...layout, pageWidth: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Barcode Orientation</label>
            <select
              value={layout.orientation}
              onChange={(e) => setLayout({ ...layout, orientation: e.target.value as 'horizontal' | 'vertical' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Boxes Horizontal</label>
              <input
                type="number"
                value={layout.boxesHorizontal}
                onChange={(e) => setLayout({ ...layout, boxesHorizontal: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Boxes Vertical</label>
              <input
                type="number"
                value={layout.boxesVertical}
                onChange={(e) => setLayout({ ...layout, boxesVertical: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Box Width (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.boxWidth}
                onChange={(e) => setLayout({ ...layout, boxWidth: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Box Height (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.boxHeight}
                onChange={(e) => setLayout({ ...layout, boxHeight: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Vertical Gap (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.verticalGap}
                onChange={(e) => setLayout({ ...layout, verticalGap: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Horizontal Gap (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.horizontalGap}
                onChange={(e) => setLayout({ ...layout, horizontalGap: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Top Margin (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.marginTop}
                onChange={(e) => setLayout({ ...layout, marginTop: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bottom Margin (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.marginBottom}
                onChange={(e) => setLayout({ ...layout, marginBottom: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Left Margin (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.marginLeft}
                onChange={(e) => setLayout({ ...layout, marginLeft: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Right Margin (mm)</label>
              <input
                type="number"
                step="0.1"
                value={layout.marginRight}
                onChange={(e) => setLayout({ ...layout, marginRight: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Save Layout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LayoutEditor;