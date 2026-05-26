import cv2
import numpy as np

def gentle_document_cleaning(image, cleaning_strength='medium'):
    """
    CONSERVATIVE document cleaning - ONLY removes color cast.
    Does NOT aggressively change brightness or wash out the image.
    
    Args:
        image: OpenCV image (BGR) - after Fourier shadow removal
        cleaning_strength: 'light', 'medium', or 'heavy'
    
    Returns:
        Cleaned image with color cast removed
    """
    
    try:
        if image is None or image.size == 0:
            return image
        
        # Convert to LAB color space
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        
        A_float = A.astype(np.float32)
        B_float = B.astype(np.float32)
        L_float = L.astype(np.float32)
        
        # Find white paper color (brightest areas)
        L_bright = np.percentile(L, 95)
        white_pixels = L > (L_bright - 20)
        
        if white_pixels.any():
            A_white_mean = np.mean(A[white_pixels])
            B_white_mean = np.mean(B[white_pixels])
        else:
            A_white_mean = 128
            B_white_mean = 128
        
        # Calculate color cast
        A_cast = A_white_mean - 128
        B_cast = B_white_mean - 128
        
        # Remove color cast based on strength
        if cleaning_strength == 'light':
            A_corrected = A_float - A_cast * 0.4
            B_corrected = B_float - B_cast * 0.4
        elif cleaning_strength == 'medium':
            A_corrected = A_float - A_cast * 0.7
            B_corrected = B_float - B_cast * 0.7
        else:  # heavy
            A_corrected = A_float - A_cast * 0.95
            B_corrected = B_float - B_cast * 0.95
        
        A_corrected = np.clip(A_corrected, 0, 255).astype(np.uint8)
        B_corrected = np.clip(B_corrected, 0, 255).astype(np.uint8)
        
        # Minimal luminance adjustment
        L_final = L.copy().astype(np.float32)
        
        if cleaning_strength == 'medium':
            bright_mask = L > np.percentile(L, 95)
            L_final[bright_mask] = np.clip(L_final[bright_mask] * 1.02, 0, 255)
        elif cleaning_strength == 'heavy':
            bright_mask = L > np.percentile(L, 95)
            L_final[bright_mask] = np.clip(L_final[bright_mask] * 1.04, 0, 255)
        
        L_final = np.clip(L_final, 0, 255).astype(np.uint8)
        
        # Reconstruct image
        result = cv2.cvtColor(cv2.merge((L_final, A_corrected, B_corrected)), cv2.COLOR_LAB2BGR)
        
        return result
    
    except Exception as e:
        print(f"Error in cleaning: {e}")
        return image