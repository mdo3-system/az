import React from 'react';
import { Routes, Route } from 'react-router-dom';
import BarcodeGenerator from './components/BarcodeGenerator';
import LayoutEditor from './components/LayoutEditor';

function App() {
  return (
    <Routes>
      <Route path="/" element={<BarcodeGenerator />} />
      <Route path="/layout/new" element={<LayoutEditor />} />
    </Routes>
  );
}

export default App;