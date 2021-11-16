// https://reservation.frontdesksuite.ca/rcfs/
// hintonburgcc Wednesday Pickleball 6, 7:15, 8:30
// francoisdupuis Pickleball - Adult Thursday 6:30, 7:45
// francoisdupuis Pickleball - All ages Sunday 12:30, 1:45
// mintobarrhaven Pickleball Saturday 11:45, 1:00
// richcraftkanata Pickleball Sunday 10:15

function getElementWithText(selector, text, root = document) {
    return [...root.querySelectorAll(selector).values()].find(el => el.textContent.includes(selector))
 }
 
 getElementWithText('a', 'Pickleball')
 document.querySelector('input#reservationCount')
 const scheduleForDay = getElementWithText('.date', 'Wednesday')
 getElementWithText('a', '7:45', scheduleForDay) // Disabled: li.reserved
 document.querySelector('input#telephone')
 document.querySelector('input#email')
 const nameContainer = getElementWithText('label', 'Name')
 const nameInput = nameContainer.querySelector('input')
 document.querySelector('#submit-btn')
 