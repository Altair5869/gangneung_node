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
        };
      };
    };
  }
}

export {};
