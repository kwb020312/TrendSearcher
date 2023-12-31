const express = require("express");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { NAVER_SHOPPING_BEST_KEYWORD } = require("./assets/constant/naver");

const app = express();
const port = 3000;

app.get("/", async (req, res) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(90000);
    await page.goto(NAVER_SHOPPING_BEST_KEYWORD, { waitUntil: "networkidle0" });

    // 페이지의 HTML을 가져옵니다.
    const content = await page.content();

    // Puppeteer로 가져온 HTML 컨텐츠에 Cheerio를 사용합니다.
    const $ = cheerio.load(content);
    const result = [];

    // 네이버 인기순위 접근
    $(".list_keyword > li > a")
      .contents()
      .filter(function () {
        return this.type === "text";
      })
      .each(async function (i, _) {
        const curText = $(this).text().trim();
        result[i] = { keyword: curText, items: [] };
        if (i !== 0) {
          await page.waitForSelector("[class^='chartList_btn_keyword']");
          const openNextItem = await page.$$(
            "[class^='chartList_btn_keyword']"
          );
          await openNextItem[i].evaluate((b) => b.click());
          await page.waitForNavigation();

          await page.waitForSelector('[class^="chartList_text_area"]');
          const getItemData = await page.$('[class^="chartList_text_area"]');
          const item = await getItemData.evaluate((b) => b.innerHTML);
          const exceptTag = item.replace(/<\/?[^>]+(>|$)/g, "");
          const [value, key] = exceptTag.split("원");
          result[i].items.push({ title: key, price: value + "원" });
        } else {
          $('[class^="chartList_text_area"]').each(function () {
            const key = $(this)
              .find("[class^='chartList_title']")
              .text()
              .trim();
            const value = $(this)
              .find("[class^='chartList_price']")
              .text()
              .trim();
            result[i].items.push({ title: key, price: value });
          });
        }
      });

    // await browser.close();
    res.status(200).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error occurred during crawling.");
  }
});

// 관세법령 정보포털 스크래핑
app.get("/test", async (req, res) => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);

  // 접근주소
  await page.goto("https://unipass.customs.go.kr/clip/index.do");

  // 검색 기능 창에 검색어 입력
  // 검색창 선택자: #uniSrchText2
  await page.type("#uniSrchText2", "720110");

  // 검색 실행 후, 페이지 로드를 기다립니다.
  // 검색버튼 선택자: #btnHsSearch
  await Promise.all([
    page.$eval("#btnHsSearch", (el) => el.click()),
    page.waitForNavigation({ waitUntil: "load" }),
  ]);

  await page.evaluate(() => {
    let element = document.getElementById("quickmenu");
    if (element) element.parentNode.removeChild(element);
  });

  // 결과물 캡처
  await page.screenshot({ path: "./assets/result/result.png", fullPage: true });

  await browser.close();

  res.status(200).send("사진 저장에 성공했습니다.");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
