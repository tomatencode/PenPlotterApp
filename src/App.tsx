import { HashRouter, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import DocumentScreen from "./screens/DocumentScreen";
import TitleBar from "./components/TitleBar";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <div className="flex flex-col h-screen overflow-hidden">
        <TitleBar />
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/document" element={<DocumentScreen />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
