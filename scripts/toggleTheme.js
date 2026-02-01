const theme = localStorage.getItem("theme");
const toggleBtn = document.querySelector("#btn-toggle-theme");
const body = document.body;

if (theme === "light") {
	body.classList.add("light");
} else body.classList.remove("light");

toggleBtn.addEventListener("click", () => {
	body.classList.toggle("light");
	const theme = localStorage.getItem("theme");
	localStorage.setItem("theme", theme === "light" ? "dark" : "light");
});
