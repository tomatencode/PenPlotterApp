import { HashRouter, Route, Routes } from "react-router-dom";
import HomeScreen from "./screens/HomeScreen";
import DocumentScreen from "./screens/DocumentScreen";
import PlotterScreen from "./screens/PlotterScreen";
import GcodeScreen from "./screens/GcodeScreen";
import TitleBar from "./components/TitleBar";
import { PlotterDiscoveryProvider } from "./context/PlotterDiscoveryContext";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <PlotterDiscoveryProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <TitleBar />
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/document" element={<DocumentScreen />} />
              <Route path="/plotter" element={<PlotterScreen />} />
              <Route path="/gcode" element={<GcodeScreen />} />
            </Routes>
          </div>
        </div>
      </PlotterDiscoveryProvider>
    </HashRouter>
  );
}

export default App;
