
export const mockPurposeCategories = [
    {
      id: "1",
      name: "기념일·이벤트",
      children: [
        { id: "11", parent_id: "1", name: "생일" },
        { id: "12", parent_id: "1", name: "연인·부부 기념일" },
        { id: "13", parent_id: "1", name: "합격·취업·승진" },
        { id: "14", parent_id: "1", name: "감사·답례" },
        { id: "15", parent_id: "1", name: "졸업·입학" },
        { id: "16", parent_id: "1", name: "명절·시즌이벤트" },
        { id: "17", parent_id: "1", name: "출산·돌" },
        { id: "18", parent_id: "1", name: "개업·이전" },
      ],
    },
    {
      id: "2",
      name: "모임·행사",
      children: [
        { id: "21", parent_id: "2", name: "집들이" },
        { id: "22", parent_id: "2", name: "생일파티" },
        { id: "23", parent_id: "2", name: "홈파티" },
        { id: "24", parent_id: "2", name: "가족모임" },
        { id: "25", parent_id: "2", name: "친구모임" },
        { id: "26", parent_id: "2", name: "직장·단체 행사" },
        { id: "27", parent_id: "2", name: "스터디·동아리 모임" },
        { id: "28", parent_id: "2", name: "손님맞이·다과" },
      ],
    },
    {
      id: "3",
      name: "일상·취미",
      children: [
        { id: "31", parent_id: "3", name: "피크닉·나들이" },
        { id: "32", parent_id: "3", name: "반려동물 생활" },
        { id: "33", parent_id: "3", name: "캠핑·야외활동" },
        { id: "34", parent_id: "3", name: "휴식·셀프케어" },
        { id: "35", parent_id: "3", name: "공예·DIY" },
        { id: "36", parent_id: "3", name: "독서·문구" },
      ],
    },
  ];
  
  // 현재 MVP 시연에 사용할 수 있는 중분류
  // 추후 시연 데이터가 준비되면 ID 추가
  export const enabledPurposeIds = ["11"];
  
  export async function mockGetPurposeCategories() {
    // 실제 API 응답을 기다리는 상황을 간단히 재현
    await new Promise((resolve) => setTimeout(resolve, 300));
  
    // 실제 API처럼 data.items 내부에 들어갈 배열 반환
    return structuredClone(mockPurposeCategories);
  }
  