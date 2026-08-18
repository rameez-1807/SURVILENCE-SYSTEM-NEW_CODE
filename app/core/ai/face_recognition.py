import base64
import io
import cv2
import numpy as np
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image

class FaceRecognitionCore:
    def __init__(self):
        # Determine device
        self.device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
        
        # Initialize MTCNN for face detection
        self.mtcnn = MTCNN(
            image_size=160, margin=0, min_face_size=20,
            thresholds=[0.6, 0.7, 0.7], factor=0.709, post_process=True,
            device=self.device
        )
        
        # Initialize InceptionResnetV1 for face recognition
        self.resnet = InceptionResnetV1(pretrained='vggface2').eval().to(self.device)

    def decode_base64_image(self, base64_string: str) -> Image.Image:
        """Decode base64 string to PIL Image."""
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        
        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        return image

    def get_face_embedding(self, image: Image.Image) -> list[float] | None:
        """Detect face and get its embedding."""
        try:
            # Get cropped face
            face = self.mtcnn(image)
            
            if face is None:
                return None
            
            # Calculate embedding (unsqueeze to add batch dimension)
            embedding = self.resnet(face.unsqueeze(0).to(self.device))
            
            # Convert to list of floats for JSON serialization
            return embedding.detach().cpu().numpy().flatten().tolist()
        except Exception as e:
            print(f"Error in face embedding generation: {e}")
            return None

    def compare_embeddings(self, emb1: list[float], emb2: list[float], threshold: float = 1.0) -> tuple[bool, float]:
        """
        Compare two embeddings. Returns (match_found, distance).
        For vggface2, Euclidean distance threshold is typically ~1.0 - 1.2
        """
        t1 = torch.tensor(emb1)
        t2 = torch.tensor(emb2)
        
        distance = torch.dist(t1, t2).item()
        match_found = distance < threshold
        return match_found, distance

# Global instance for reuse
face_recognizer = FaceRecognitionCore()
