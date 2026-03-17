import React, { useState } from 'react';
import { X } from 'lucide-react';

export const AddTableModal = ({ onClose, onSave }: { onClose: () => void, onSave: (name: string) => void }) => {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add New Table</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Table Name (e.g., Table 5)"
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500 dark:text-white"
        />
        <button
          onClick={() => onSave(name)}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          Add Table
        </button>
      </div>
    </div>
  );
};
