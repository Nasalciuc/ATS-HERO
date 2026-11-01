// Shared by the lab's forms: on submit, show what the "employer" received. Nothing leaves the page.
window.labShow = function (received, message) {
  document.querySelector("form").hidden = true;
  const out = document.getElementById("received");
  out.hidden = false;
  out.querySelector("h2").textContent = message;
  out.querySelector("pre").textContent = "RECEIVED " + JSON.stringify(received) + " END";
};
