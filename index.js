console.log('hello')
const puppeteer = require('puppeteer');
const fs = require('fs');

const todayStr = (() => {
  const date = new Date();
  return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getDate()}`;
})()
// json 파일 작성
const writeJsonFile = (fileName, data) => {
  const dataJSON = JSON.stringify(data);
  fs.writeFileSync(fileName + '.json', dataJSON);
}
const mkdir = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path)
  }
}

// log쌓기
const logger = {
  messageStore: [],
  log: function(msg) {
      console.log(msg);
      this.messageStore.push(msg);
  },
  save: function() {
      console.log(this.messageStore.join('\n'));
  }
}

const sidoCodeList = [
  ["서울특별시",	"11"],
  ["부산광역시",	"26"],
  ["대구광역시",	"27"],
  ["인천광역시",	"28"],
  ["광주광역시",	"29"],
  ["대전광역시",	"30"],
  ["울산광역시",	"31"],
  ["세종특별자치시",	"36"],
  ["경기도",	"41"],
  ["강원도",	"42"],
  ["충청북도",	"43"],
  ["충청남도",	"44"],
  ["전라북도",	"45"],
  ["전라남도",	"46"],
  ["경상북도",	"47"],
  ["경상남도",	"48"],
  ["제주특별자치도",	"50"]
];


(async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  
  mkdir(`result/${todayStr}`);
  mkdir(`log/${todayStr}`);
  for (let i = 0; i < sidoCodeList.length; i++ ) {
    const searchStartTime = new Date().toLocaleString();
    const sidoName = sidoCodeList[i][0];
    const sidoCd = sidoCodeList[i][1];

    try {
      // 해당 URL로 이동
      console.log('해당 URL로 이동');
      await page.goto(`https://www.longtermcare.or.kr/npbs/r/a/201/selectXLtcoSrch.web?siDoCd=${sidoCd}&searchAdminKindCdS=01,03,06`);

      // 목록검색 탭으로 이동
      console.log('[목록검색 탭으로 이동]');
      await page.click('.special_tab2 > li:nth-child(2) > a');
      
      // 페이지가 로드될 때까지 기다리기
      console.log('[페이지 로드 대기]');
      await page.waitForNavigation();
    
      // 페이지 이동하면서 모든 데이터 수집
      let data = [];
      let pageIdx = 1;
      await page.waitForTimeout(3000);
      const totalCount = await page.evaluate(() => document.querySelector('.tot_txt > strong').textContent.replace('Total ', ''));
      console.log('[데이터 수집 시작]');
      while (true) {
        // 현재 페이지에서 정보 가져오기
        const pageData = await page.evaluate(() => {
          const results = [];
          // 각 row에서 정보 가져오기
          const rows = document.querySelectorAll('#ltco_info_list > tbody > tr');
          rows.forEach(row => {
            const 연번 = row.querySelector('td.no').textContent.trim();                       // 연번
            const 기관코드 = row.querySelector('td.fir_ch input').value;                       // 기관코드
            const 기관명 = row.querySelector('td:nth-child(3)').textContent.trim();           // 기관명
            const 급여종류 = row.querySelector('td:nth-child(4)').textContent.trim();         // 급여종류
            const 정원 = row.querySelector('td:nth-child(6)').textContent.trim();             // 정원
            const 현원 = row.querySelector('td:nth-child(7)').textContent.trim();             // 현원
            const 잔여 = row.querySelector('td:nth-child(8)').textContent.trim();             // 잔여
            const 대기 = row.querySelector('td:nth-child(9)').textContent.trim();             // 대기
            const 주소 = row.querySelector('td:nth-child(11)').textContent.trim();            // 주소
            const 전화번호 = row.querySelector('td:nth-child(12)').textContent.trim();         // 전화번호
            const 상세URL = row.querySelector('td:nth-child(3) > a').href.trim();             // 상세URL
            results.push({ 연번, 기관코드, 기관명, 급여종류, 주소, 전화번호, 정원, 현원, 잔여, 대기, 상세URL });
          });
          
          return results;
        });

        // 페이지 데이터를 전체 데이터에 추가
        data = data.concat(pageData);
        pageIdx++;
    
        console.log(`[${sidoName}]데이터 검색률: ${data.length} / ${totalCount}`);
        const pageNavigation = await page.$(`#main_paging`)

        // 다음 버튼명 수집
        let [nextPageButton] = await pageNavigation.$x(`//a[contains(., '${pageIdx}')]`);
        if (!nextPageButton) {
          nextPageButton = await page.$(`#main_paging > .page_next`);
        }
        
        if (!nextPageButton) {
          console.log('[마지막 페이지 인식]');
          break;
        } else {
          const idxCheck = await nextPageButton.evaluate(el => el.textContent);
          console.log(`타겟 페이지: ${pageIdx} / 실제클릭 버튼명: ${idxCheck}`)
          await nextPageButton.click();
          await page.waitForNavigation();
        }
      }
    
      // 파일로 내보내기
      const jsonData = {
        cityName: sidoName,
        startDate: `[검색시작]${searchStartTime}`,  
        endDate: `[검색종료]${new Date().toLocaleString()}`,
        searchRate: `${data.length} / ${totalCount}`,      // 
        searchPageIndex: (pageIdx - 1), // 검색 페이지 수 (최대 페이지 수와 같다면 이상없음.)
        data
      }
      
      writeJsonFile(`result/${todayStr}/${sidoName}`, jsonData);

      // 다음 도시 검색을 위한 대기 시간
      await page.waitForTimeout(1000);
    } catch(e) {
      const errorTime = new Date().toLocaleString();
      const errorJSON = {
        시간: errorTime,
        에러발생위치: sidoName,
        내용: e,
        로그기록: logger.save()
      };

      mkdir(`errorLog/${todayStr}`);
      writeJsonFile(`errorLog/${todayStr}/${sidoName}`, errorJSON);
    }
  }
  logger.log('[종료]');

  writeJsonFile(`log/${todayStr}/log`, logger.save());

  await browser.close();
})()


