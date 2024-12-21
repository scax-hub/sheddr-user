import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '../context/ThemeContext';
import HomePage from '../pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Toaster />
        <HomePage />
      </ThemeProvider>
    </BrowserRouter>
  );
} 