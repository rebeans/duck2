let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installBanner = document.createElement('button');
    installBanner.textContent = "홈 화면에 추가하기";
    installBanner.style.position = 'fixed';
    installBanner.style.top = '10px';
    installBanner.style.left = '10px';
    installBanner.style.padding = '10px';
    installBanner.style.background = '#2196F3';
    installBanner.style.color = 'white';
    installBanner.style.border = 'none';
    installBanner.style.borderRadius = '5px';
    installBanner.style.zIndex = '9999';
    installBanner.style.transition = 'opacity 2s ease';
    installBanner.style.opacity = '1';

    document.body.appendChild(installBanner);

    setTimeout(() => {
        installBanner.style.opacity = '0';
    }, 8000);

    setTimeout(() => {
        installBanner.remove();
    }, 10000);

    installBanner.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`사용자 반응: ${outcome}`);
            deferredPrompt = null;
            installBanner.remove();
        }
    });
});

function getSeoulDate() {
    const now = new Date();
    const seoulTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const year = seoulTime.getFullYear();
    const month = String(seoulTime.getMonth() + 1).padStart(2, '0');
    const day = String(seoulTime.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// ✅ 날짜 범위 계산
function getValidDates() {
    const today = getSeoulDate();
    const tomorrow = (() => {
        const now = new Date();
        const seoulTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        seoulTime.setDate(seoulTime.getDate() + 1);
        const y = seoulTime.getFullYear();
        const m = String(seoulTime.getMonth() + 1).padStart(2, '0');
        const d = String(seoulTime.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    })();
    return [today, tomorrow];
}

function getHourMinute(timeString) {
    const str = String(timeString);
    return str.slice(-4);
}

async function fetchData() {
    
    const proxy = 'https://duck-proxy.iamijh78.workers.dev';

    const targetArr = encodeURIComponent('http://144.24.74.26:3000/arrivals.json');
    const targetDep = encodeURIComponent('http://144.24.74.26:3000/departures.json');

    const urlArr = `${proxy}/${targetArr}`;
    const urlDep = `${proxy}/${targetDep}`;

    const [arrResponse, depResponse] = await Promise.all([
    fetch(urlArr),
    fetch(urlDep),
    ]);

    const arrData = await arrResponse.json();
    const depData = await depResponse.json();

    return { arrData, depData };
}

function getClassName(remark) {
    const classMap = {
        "탑승중": "remark-bor",
        "탑승마감": "remark-bor-e",
        "마감예정": "remark-bor-ee",
        "착륙": "remark-arr"
    };
    return classMap[remark] || "";
}

function filterAndGroupData(dataArr, dataDep) {
    const [today, tomorrow] = getValidDates();
    const filteredData = [];

    dataArr.response.body.items.forEach(item => {
        const datePart = String(item.estimatedDatetime || "").slice(0, 8);
        if (
            (datePart === today || datePart === tomorrow) &&
            item.terminalId === "P02" &&   // 여기서도 terminalId 대소문자 확인 필요
            item.codeshare !== "Slave" &&
            item.remark !== "도착" &&
            item.gateNumber
        ) {
            filteredData.push({
                arr_dep: "↘",
                originalDateTime: item.estimatedDatetime || "",
                estimatedDateTime: getHourMinute(item.estimatedDatetime) || "",
                flightId: item.flightId || "",
                aircraftSubtype: item.aircraftSubtype ? `(${item.aircraftSubtype})` : "",
                aircraftRegNo: item.aircraftRegNo || "",
                gatenumber: item.gateNumber || "",
                remark: item.remark || "",
                class_name: getClassName(item.remark)
            });
        }
    });


    dataDep.response.body.items.forEach(item => {
        const datePart = String(item.estimatedDatetime || "").slice(0, 8);
        if (
            (datePart === today || datePart === tomorrow) &&
            item.terminalId === "P02" &&
            item.codeshare !== "Slave" &&
            item.remark !== "출발" &&
            item.gateNumber
        ) {
            let remark = item.remark;
            if (["체크인오픈", "탑승준비", "체크인마감"].includes(remark)) remark = "";
            filteredData.push({
                arr_dep: "↗",
                originalDateTime: item.estimatedDatetime || "",
                estimatedDateTime: getHourMinute(item.estimatedDatetime) || "",
                flightId: item.flightId || "",
                aircraftSubtype: item.aircraftSubtype ? `(${item.aircraftSubtype})` : "",
                aircraftRegNo: item.aircraftRegNo || "",
                gatenumber: item.gateNumber || "",
                remark: remark || "",
                class_name: getClassName(remark)
            });
        }
    });

    const gateData = {};
    filteredData.forEach(item => {
        const gateNumber = item.gatenumber;
        if (!gateData[gateNumber]) gateData[gateNumber] = { gatenumber: gateNumber, flights: [] };
        gateData[gateNumber].flights.push(item);
    });

    Object.values(gateData).forEach(gate => {
        gate.flights.sort((a, b) => a.originalDateTime.localeCompare(b.originalDateTime));
    });

    return gateData;
}

function customGateSort(gateNumbers) {
    const groups = [
        [101, 102, 103, 104, 105, 106],
        [107, 109, 111, 113],
        [108, 110, 112, 114],
        [115, 117, 119],
        [118, 122, 124],
        [121, 123, 125],
        [126, 128, 130],
        [127, 129, 131, 132]
    ];

    const gateNumberMap = Object.fromEntries(gateNumbers.map(num => [parseInt(num, 10), num]));

    const sortedWithGroups = [];

    groups.forEach((group, groupIndex) => {
        group.forEach(num => {
            if (gateNumberMap[num]) {
                sortedWithGroups.push({ gateNumber: gateNumberMap[num], groupIndex });
            }
        });
    });

    return sortedWithGroups;
}

function createFlightTable(gateData) {
    const table = document.createElement('table');

    // 헤더
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>';
    const maxFlights = Math.max(...Object.values(gateData).map(gate => gate.flights.length));
    for (let i = 0; i < maxFlights; i++) {
        headerRow.innerHTML += `<th>${i + 1}</th>`;
    }
    table.appendChild(headerRow);

    const sortedGateEntries = customGateSort(Object.keys(gateData));

    sortedGateEntries.forEach(({ gateNumber, groupIndex }) => {
        const gate = gateData[gateNumber];
        if (!gate) return;

        const row = document.createElement('tr');
        if (groupIndex % 2 === 1) {
            row.style.backgroundColor = '#eeeeee';
        }

        row.innerHTML = `<td class="sticky-col">${gateNumber}</td>`;

        gate.flights.forEach(flight => {
            const className = flight.class_name;

            // 기본 화살표 색상
            let arrowColor = flight.arr_dep === "↘" ? '#008000' : '#004080';

            // td 전체 글자색 조건: 도착편, 오늘 착륙 예정, 착륙 전 20분 이내, 착륙 상태 아님
            let cellStyle = '';
            if (
                flight.arr_dep === "↘" &&
                flight.estimatedDateTime &&
                flight.remark !== "착륙"
            ) {
                const [today] = getValidDates();
                const flightDate = flight.originalDateTime.slice(0, 8); // yyyyMMdd

                // ✅ 오늘 날짜인 경우에만 시간 차 계산
                if (flightDate === today) {
                    const now = new Date();
                    const seoulNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
                    const hh = parseInt(flight.estimatedDateTime.slice(0, 2), 10);
                    const mm = parseInt(flight.estimatedDateTime.slice(2, 4), 10);
                    const estTime = new Date(seoulNow);
                    estTime.setHours(hh, mm, 0, 0);

                    const diffMinutes = (estTime - seoulNow) / 60000; // 차이 분 단위
                    if (diffMinutes >= 0 && diffMinutes <= 20) {
                        cellStyle = 'color:red;'; // td 전체 글자 빨강
                    }
                }
            }


            let cellContent = `<div class="content-all" style="${cellStyle}">`;
            cellContent += `<p class="compact"><span style="color: ${arrowColor}; font-weight: bold; font-size: 1.2em;">${flight.arr_dep}</span>${flight.estimatedDateTime}</p>`;
            cellContent += `<p class="compact">${flight.flightId} ${flight.aircraftSubtype}</p>`;
            cellContent += `<p class="compact">${flight.aircraftRegNo}</p>`;
            cellContent += `<p class="compact">${flight.remark}</p>`;
            cellContent += '</div>';

            row.innerHTML += `<td class="${className}">${cellContent}</td>`;
        });

        // 비어있는 셀 채우기
        for (let i = 0; i < maxFlights - gate.flights.length; i++) {
            row.innerHTML += '<td></td>';
        }

        table.appendChild(row);
    });

    return table;
}

function renderData(gateData) {
    const container = document.getElementById('flight-info');
    const table = createFlightTable(gateData);
    container.appendChild(table);
}

function updateData(newGateData) {
    const container = document.getElementById('flight-info');
    const newTable = createFlightTable(newGateData);

    const oldTable = container.querySelector('table');
    if (!oldTable || oldTable.outerHTML !== newTable.outerHTML) {
        if (oldTable) container.removeChild(oldTable);
        container.appendChild(newTable);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const refreshBtn = document.getElementById('refresh-button');
    const dutyBtn = document.getElementById('duty-button');

    refreshBtn.classList.add('loading');
    dutyBtn.classList.remove('loading');

    // 데이터 불러오기
    const { arrData, depData } = await fetchData();
    const gateData = filterAndGroupData(arrData, depData);
    updateData(gateData);

    refreshBtn.classList.remove('loading');

    // 새로고침 버튼 동작
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('loading');

        // ✅ 현재 스크롤 위치 저장
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        const { arrData, depData } = await fetchData();
        const gateData = filterAndGroupData(arrData, depData);
        updateData(gateData);
        
        // ✅ 렌더링 완료 후 스크롤 위치 복원
        setTimeout(() => {
            window.scrollTo(scrollX, scrollY);
        }, 0);
        
        refreshBtn.classList.remove('loading');
        });
    
    // 당직 버튼 동작     
    dutyBtn.addEventListener('click', () => {
        dutyBtn.classList.add('loading');
        window.location.href = "https://rebean.duckdns.org/p02_duty";
    })

   // 뒤로가기나 히스토리 이동 시 로딩 해제
    window.addEventListener('pageshow', () => {
        dutyBtn.classList.remove('loading');
        nextdayBtn.classList.remove('loading');
    });

    // 앱 전환 또는 탭 전환 시 로딩 해제
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            dutyBtn.classList.remove('loading');
        }
    });
    
    let timer;
    const longPressDelay = 500;
    let touchStartDistance = 0;
    let isDragging = false;
    let startX, startY;

    const table = document.getElementById('flight-info');
    table.addEventListener('mousedown', startMouseTimer);
    table.addEventListener('mouseup', clearTimer);
    table.addEventListener('mouseleave', clearTimer);
    table.addEventListener('mousemove', handleMouseMove);
    table.addEventListener('touchstart', startTouchTimer);
    table.addEventListener('touchend', clearTimer);
    table.addEventListener('touchcancel', clearTimer);
    table.addEventListener('touchmove', detectPinchZoomOrDrag);

    function startMouseTimer(event) {
        const cell = event.target.closest('td');
        if (!cell) return;
        clearTimer();
        isDragging = false;
        startX = event.pageX;
        startY = event.pageY;
        timer = setTimeout(() => {
            if (!isDragging) {
                handleLongPress(cell);
            }
        }, longPressDelay);
    }

    function startTouchTimer(event) {
        const cell = event.target.closest('td');
        if (!cell) return;
        clearTimer();
        isDragging = false;
        if (event.touches.length === 1) {
            startX = event.touches[0].pageX;
            startY = event.touches[0].pageY;
            timer = setTimeout(() => {
                if (!isDragging) {
                    handleLongPress(cell);
                }
            }, longPressDelay);
        } else if (event.touches.length === 2) {
            touchStartDistance = getDistance(event.touches[0], event.touches[1]);
        }
    }

    function handleLongPress(cell) {
        const div = cell.querySelector('div');
        if (div) {
            const paragraphs = div.getElementsByTagName('p');
            if (paragraphs.length >= 2) {
                let flightNumber = paragraphs[2].innerText.trim();
                if (flightNumber) {
                    flightNumber = flightNumber.replace(/^([A-Z]+)0+/, '$1');
                    const url = `https://www.flightradar24.com/${flightNumber}?force_browser=1`;
                    window.location.href = url;
                }
            }
        }
    }

    function clearTimer() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function handleMouseMove(event) {
        if (Math.abs(event.pageX - startX) > 10 || Math.abs(event.pageY - startY) > 10) {
            isDragging = true;
            clearTimer();
        }
    }

    function detectPinchZoomOrDrag(event) {
        if (event.touches.length === 2) {
            const currentDistance = getDistance(event.touches[0], event.touches[1]);
            if (Math.abs(currentDistance - touchStartDistance) > 10) {
                clearTimer();
            }
        } else if (event.touches.length === 1) {
            if (Math.abs(event.touches[0].pageX - startX) > 10 || Math.abs(event.touches[0].pageY - startY) > 10) {
                isDragging = true;
                clearTimer();
            }
        }
    }

    function getDistance(touch1, touch2) {
        return Math.sqrt(Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2));
    }

    // 터치 시 텍스트 선택 방지 (iOS Safari용)
    table.addEventListener('touchstart', (e) => {
        if (window.getSelection) {
            window.getSelection().removeAllRanges(); // 선택 해제
        }
    });
});
