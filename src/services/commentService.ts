import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  orderBy,
  query,
  where,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Comment {
  id?: string;
  photoId: string | number;
  author: string;
  content: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Add comment
export async function addComment(photoId: string | number, author: string, content: string): Promise<string> {
  try {
    if (!db) {
      throw new Error('Firestore is not configured correctly, please check environment variables');
    }

    if (!content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    if (!author.trim()) {
      throw new Error('Author name cannot be empty');
    }

    const docRef = await addDoc(collection(db, 'comments'), {
      photoId: String(photoId),
      author: author.trim(),
      content: content.trim(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('Comment added successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Failed to add comment:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        throw new Error('No write permission, please check Firestore rules');
      } else if (error.message.includes('network')) {
        throw new Error('Network connection failed, please check your network connection');
      }
      throw error;
    }

    throw new Error('Failed to add comment, please try again');
  }
}

// Get all comments for a photo
export async function getCommentsByPhotoId(photoId: string | number): Promise<Comment[]> {
  try {
    if (!db) {
      throw new Error('Firestore is not configured correctly, please check environment variables');
    }

    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef,
      where('photoId', '==', String(photoId)),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const comments: Comment[] = [];

    querySnapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data()
      } as Comment);
    });

    return comments;
  } catch (error) {
    console.error('Failed to get comments:', error);
    throw new Error('Failed to get comments, please try again');
  }
}

// Real-time listener for comments
export function subscribeToComments(
  photoId: string | number,
  callback: (comments: Comment[]) => void
): () => void {
  try {
    if (!db) {
      console.error('Firestore is not configured correctly');
      return () => { };
    }

    const commentsRef = collection(db, 'comments');

    // Try using orderBy first, if fails then use only where
    let q;
    try {
      q = query(
        commentsRef,
        where('photoId', '==', String(photoId)),
        orderBy('createdAt', 'desc')
      );
    } catch (indexError) {
      // If index doesn't exist, use only where query, then sort client-side
      console.warn('Composite index does not exist, using simplified query:', indexError);
      q = query(
        commentsRef,
        where('photoId', '==', String(photoId))
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const comments: Comment[] = [];
        snapshot.forEach((doc) => {
          comments.push({
            id: doc.id,
            ...doc.data()
          } as Comment);
        });
        // If orderBy was not used, sort client-side
        if (!q.toString().includes('orderBy')) {
          comments.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime; // Descending
          });
        }
        callback(comments);
      },
      (error) => {
        console.error('Failed to listen for comments:', error);
        // If query fails, return empty array instead of breaking
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Failed to subscribe to comments:', error);
    // Return empty array
    callback([]);
    return () => { };
  }
}

// Delete comment
export async function deleteComment(commentId: string): Promise<void> {
  try {
    if (!db) {
      throw new Error('Firestore is not configured correctly, please check environment variables');
    }

    await deleteDoc(doc(db, 'comments', commentId));
    console.log('Comment deleted successfully:', commentId);
  } catch (error) {
    console.error('Failed to delete comment:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        throw new Error('No delete permission, please check Firestore rules');
      }
      throw error;
    }

    throw new Error('Failed to delete comment, please try again');
  }
}
