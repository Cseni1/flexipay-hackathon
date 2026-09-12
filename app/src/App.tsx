import { Route, Routes } from "react-router-dom"
import FlexiPay from "./components/FlexiPay"

function App() {
	return (
		<Routes>
			<Route path="*" element={<FlexiPay />} />
		</Routes>
	)
}

export default App
