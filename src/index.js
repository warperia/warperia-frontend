import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './css/custom.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<App />);
