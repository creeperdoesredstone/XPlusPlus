const toggleBtn = document.querySelector("#btn-toggle-theme");
const body = document.body;

toggleBtn.addEventListener("click", () => {
	body.classList.toggle("light");
});
