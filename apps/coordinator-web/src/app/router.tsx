import { createBrowserRouter } from 'react-router';
import { PoskoApp } from '../features/posko-app.js';

export const router = createBrowserRouter([{ path: '*', element: <PoskoApp /> }]);
