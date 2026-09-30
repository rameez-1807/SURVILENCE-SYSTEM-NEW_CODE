import time
import numpy as np

class MockVideoCapture:
    """
    Mocks cv2.VideoCapture for testing.
    Allows simulating various states like offline, broken stream, etc.
    """
    def __init__(self, source):
        self.source = source
        self.is_open = True
        
        if "offline" in str(source):
            self.is_open = False
            
        if "auth_fail" in str(source):
            self.is_open = False
            
        self.frame_count = 0
        self.fail_after = -1 # fail after N frames
        
        if "fail_after_" in str(source):
            try:
                # Format: mock://fail_after_5
                self.fail_after = int(str(source).split("fail_after_")[1])
            except:
                pass

    def isOpened(self):
        return self.is_open

    def read(self):
        if not self.is_open:
            return False, None
            
        if self.fail_after != -1 and self.frame_count >= self.fail_after:
            return False, None
            
        self.frame_count += 1
        
        # Simulate work
        time.sleep(0.01)
        
        # Create a dummy image (e.g. 640x480 black image)
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        return True, frame

    def release(self):
        self.is_open = False
