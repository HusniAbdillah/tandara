import { createBrowserRouter } from 'react-router';
import { ResidentApp } from '../features/resident-app.js';

export const router = createBrowserRouter([{ path: '*', element: <ResidentApp /> }]);
