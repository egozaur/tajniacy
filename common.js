/* Kod wspólny dla index.html i captain.html */

/* Zmniejsza czcionkę elementów pasujących do selektora, aż tekst zmieści się w karcie. */
function fitCards(sel){document.querySelectorAll(sel).forEach(el=>{el.style.fontSize='';let fs=parseFloat(getComputedStyle(el).fontSize),n=0;while((el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)&&fs>7&&n++<40){fs-=1;el.style.fontSize=fs+'px';}});}
