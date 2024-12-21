export interface Location {
  id: string;
  regionName: string;
  areaCode: string;
  suburbName: string;
}

export interface Schedule {
  id: string;
  locationId: string;
  stage: number;
  startTime: string;
  endTime: string;
  date: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}