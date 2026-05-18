import cv2
import numpy as np

def gentle_document_cleaning(image, cleaning_strength='medium'):
    """
    CONSERVATIVE document cleaning - ONLY removes color cast.
    Does NOT aggressively change brightness or wash out the image.
    
    Strategy:
    1. Remove yellow/orange/brown color cast
    2. Keep luminance (brightness) mostly unchanged
    3. Preserve text contrast
    4. Minimal processing for minimal damage
    
    Args:
        image: OpenCV image (BGR) - after Fourier shadow removal
        cleaning_strength: 'light', 'medium', or 'heavy'
    
    Returns:
        Cleaned image with color cast removed, minimal changes to brightness
    """
    
    try:
        # === STEP 1: Convert to LAB color space ===
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        
        A_float = A.astype(np.float32)
        B_float = B.astype(np.float32)
        L_float = L.astype(np.float32)
        
        # === STEP 2: Analyze the color cast ===
        # Find what the "white paper" color actually is
        
        L_bright = np.percentile(L, 95)  # Top 5% brightest
        white_pixels = L > (L_bright - 20)
        
        if white_pixels.any():
            # What color is the white paper?
            A_white_mean = np.mean(A[white_pixels])
            B_white_mean = np.mean(B[white_pixels])
        else:
            A_white_mean = 128
            B_white_mean = 128
        
        # How much color cast is there?
        # 128 = neutral in LAB
        # > 128 in B = yellow cast (warm)
        # < 128 in B = blue cast (cool)
        
        A_cast = A_white_mean - 128
        B_cast = B_white_mean - 128
        
        # === STEP 3: Remove color cast based on strength ===
        
        if cleaning_strength == 'light':
            # Light: Remove 40% of the cast
            A_corrected = A_float - A_cast * 0.4
            B_corrected = B_float - B_cast * 0.4
            
        elif cleaning_strength == 'medium':
            # Medium: Remove 70% of the cast
            A_corrected = A_float - A_cast * 0.7
            B_corrected = B_float - B_cast * 0.7
            
        else:  # heavy
            # Heavy: Remove 95% of the cast
            A_corrected = A_float - A_cast * 0.95
            B_corrected = B_float - B_cast * 0.95
        
        A_corrected = np.clip(A_corrected, 0, 255).astype(np.uint8)
        B_corrected = np.clip(B_corrected, 0, 255).astype(np.uint8)
        
        # === STEP 4: MINIMAL luminance adjustment ===
        # Only slightly brighten the brightest areas (paper white)
        # Keep everything else UNCHANGED
        
        L_final = L.copy()
        
        if cleaning_strength == 'medium':
            # Brighten only top 5% by small amount
            bright_mask = L > np.percentile(L, 95)
            L_final = L_final.astype(np.float32)
            L_final[bright_mask] = np.clip(L_final[bright_mask] * 1.02, 0, 255)
            L_final = L_final.astype(np.uint8)
            
        elif cleaning_strength == 'heavy':
            # Brighten only top 5% by slightly more
            bright_mask = L > np.percentile(L, 95)
            L_final = L_final.astype(np.float32)
            L_final[bright_mask] = np.clip(L_final[bright_mask] * 1.04, 0, 255)
            L_final = L_final.astype(np.uint8)
        
        # === STEP 5: Very light wrinkle smoothing (optional) ===
        # Only for heavy: gentle bilateral filter on luminance
        # This should NOT change the overall brightness, just smooth wrinkles
        
        if cleaning_strength == 'heavy':
            # Very gentle bilateral filter
            L_smooth = cv2.bilateralFilter(L_final, 3, 30, 30)
            # Keep 95% original, 5% smoothed - almost no change
            L_final = cv2.addWeighted(L_final, 0.95, L_smooth, 0.05, 0).astype(np.uint8)
        
        # === STEP 6: Reconstruct image ===
        # Keep original brightness (L channel mostly unchanged)
        # Only change colors (A and B channels)
        
        result = cv2.cvtColor(cv2.merge((L_final, A_corrected, B_corrected)), cv2.COLOR_LAB2BGR)
        
        return result
    
    except Exception as e:
        print(f"Error in cleaning: {e}")
        import traceback
        traceback.print_exc()
        return image