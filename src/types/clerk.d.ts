declare module '@clerk/clerk-react' {
  export interface User {
    id: string;
    username: string | null;
    primaryEmailAddress?: {
      emailAddress: string;
    };
    imageUrl: string;
  }
} 