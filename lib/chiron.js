// Мост «совет → подробности от Хирона»: App регистрирует функцию, открывающую «Совет на сегодня»,
// а карточки советов (ChironTip) вызывают её по нажатию, не зная о навигации.
let opener = null;
export const setChironOpener = (fn) => { opener = typeof fn === 'function' ? fn : null; };
export const canOpenChiron = () => !!opener;
export const openChiron = () => { if (opener) opener(); };
