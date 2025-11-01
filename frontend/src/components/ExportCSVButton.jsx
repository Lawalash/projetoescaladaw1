// frontend/src/components/ExportCSVButton.jsx
import React from 'react';
import './styles/ExportCSVButton.css';

export default function ExportCSVButton({ onExport, disabled }) {
  return (
    <button
      className="export-btn"
      onClick={onExport}
      disabled={disabled}
      title="Exportar CSV - gera arquivo com o período selecionado"
    >
      📥 Exportar CSV
    </button>
  );
}
