/* eslint-disable @typescript-eslint/no-explicit-any -- 카카오맵 JS SDK는 공식 타입 정의를 제공하지 않는 앰비언트 선언이라, Map/Marker 등 생성자 인자·반환값을 any로 둘 수밖에 없다(2026-08-07, 옵션 K 요구사항 4·6). 정식 타입 재작성은 이번 라운드 비목표. */

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: {
          center: any;
          level: number;
        }) => any;
        Marker: new (options: {
          map?: any;
          position: any;
          title?: string;
          image?: any;
        }) => any;
        MarkerImage: new (src: string, size: any, options?: any) => any;
        Size: new (width: number, height: number) => any;
        Point: new (x: number, y: number) => any;
        LatLng: new (lat: number, lng: number) => any;
        CustomOverlay: new (options: {
          map?: any;
          position: any;
          content: string | HTMLElement;
          yAnchor?: number;
          xAnchor?: number;
          zIndex?: number;
        }) => any;
        Polyline: new (options: {
          map?: any;
          path: any[];
          strokeWeight?: number;
          strokeColor?: string;
          strokeOpacity?: number;
          strokeStyle?: string;
        }) => any;
        LatLngBounds: new () => {
          extend: (latlng: any) => void;
        };
        event: {
          addListener: (target: any, type: string, handler: () => void) => void;
          // KakaoMap.tsx가 지도 인스턴스를 폐기할 때(effect cleanup) idle 리스너를 실제로 떼기
          // 위해 필요하다 — 붙이기만 하고 떼지 않으면 폐기된 Map 인스턴스가 핸들러에 매달려
          // 남는다(2026-08-19, 마커 중복 이슈와 같은 계열의 누수).
          removeListener: (target: any, type: string, handler: () => void) => void;
        };
      };
    };
  }
}

export {};
