import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <HomePage />
    </BrowserRouter>
  );
}