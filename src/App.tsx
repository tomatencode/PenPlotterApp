import { HashRouter, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import DocumentScreen from "./screens/DocumentScreen";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/document" element={<DocumentScreen />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
