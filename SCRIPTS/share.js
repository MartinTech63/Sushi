/* Partage de la page : Web Share API + fallback copie lien
   -> Fonctionne sur mobile, tablette et desktop récents.
*/
function sharePage(event) {
  if (event) event.preventDefault();

  var shareUrl = "https://sushi.martintech.fr/";
  var shareTitle = "Manger des Sushis";
  var shareText = "Découvrez Manger des Sushis ! un projet visant à faciliter la prise de commande au Hanami 🍣";

  if (navigator.share) {
    navigator.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl
    }).catch(function () {});
    return false;
  }

  // Fallback desktop : tentative de copie dans le presse‑papiers
  var textToCopy = shareText + " " + shareUrl;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(function () {
      alert("Lien de partage copié dans le presse-papiers.\nVous pouvez maintenant le coller où vous voulez.");
    }).catch(function () {
      alert("Voici le lien de partage :\n" + shareUrl);
    });
  } else {
    // Fallback ultime : affiche simplement le lien
    alert("Voici le lien de partage :\n" + shareUrl);
  }

  return false;
}

document.addEventListener("DOMContentLoaded", function () {
  var shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", sharePage);
  }
});
