import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../assets/css/camera.css';

const CameraCapture = ({ onCapture, onCancel, isOpen }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [facingMode, setFacingMode] = useState('user'); // 'user' for front camera (selfie)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get GPS location
  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        });
        setIsLoadingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
        }
        setLocationError(errorMessage);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [isOpen]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsCameraReady(true);
        };
      }

      setHasPermission(true);
    } catch (error) {
      console.error('Camera error:', error);
      setHasPermission(false);

      if (error.name === 'NotAllowedError') {
        setLocationError('Camera permission denied. Please enable camera access.');
      } else if (error.name === 'NotFoundError') {
        setLocationError('No camera found on this device.');
      } else {
        setLocationError('Unable to access camera: ' + error.message);
      }
    }
  }, [facingMode]);

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      startCamera();
    }

    return () => {
      // Cleanup: stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsCameraReady(false);
    };
  }, [isOpen, startCamera]);

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas (mirror for selfie)
    if (facingMode === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add timestamp overlay
    context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, canvas.height - 60, canvas.width, 60);
    context.fillStyle = '#ffffff';
    context.font = 'bold 16px Arial';
    context.fillText(formatDateTime(currentTime), 10, canvas.height - 35);

    if (location) {
      context.font = '12px Arial';
      context.fillText(`GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`, 10, canvas.height - 15);
    }

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);

    // Stop camera after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Confirm and submit
  const confirmCapture = () => {
    if (capturedImage && onCapture) {
      onCapture({
        photo: capturedImage,
        location: location,
        capturedAt: new Date().toISOString()
      });
    }
  };

  // Switch camera (front/back)
  const switchCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  if (!isOpen) return null;

  return (
    <div className="camera-overlay">
      <div className="camera-container">
        {/* Header */}
        <div className="camera-header">
          <h2>Take Attendance Photo</h2>
          <button className="camera-close-btn" onClick={onCancel}>×</button>
        </div>

        {/* Time Display */}
        <div className="camera-time-display">
          <div className="camera-time">{formatTime(currentTime)}</div>
          <div className="camera-date">{currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</div>
        </div>

        {/* Camera View or Captured Image */}
        <div className="camera-viewport">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`camera-video ${facingMode === 'user' ? 'mirror' : ''}`}
              />
              {!isCameraReady && hasPermission === null && (
                <div className="camera-loading">
                  <div className="spinner"></div>
                  <p>Starting camera...</p>
                </div>
              )}
              {hasPermission === false && (
                <div className="camera-error">
                  <span className="camera-error-icon">📷</span>
                  <p>Camera access required</p>
                  <small>Please allow camera access in your browser settings</small>
                </div>
              )}
              {/* Selfie frame guide */}
              {isCameraReady && (
                <div className="selfie-guide">
                  <div className="selfie-circle"></div>
                </div>
              )}
            </>
          ) : (
            <img src={capturedImage} alt="Captured" className="captured-image" />
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Location Status */}
        <div className="location-status">
          {isLoadingLocation ? (
            <div className="location-loading">
              <span className="location-icon">📍</span>
              <span>Getting location...</span>
            </div>
          ) : locationError ? (
            <div className="location-error">
              <span className="location-icon">⚠️</span>
              <span>{locationError}</span>
            </div>
          ) : location ? (
            <div className="location-success">
              <span className="location-icon">📍</span>
              <span>Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
              <small>(Accuracy: ±{Math.round(location.accuracy)}m)</small>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="camera-actions">
          {!capturedImage ? (
            <>
              <button
                className="btn btn-secondary camera-switch-btn"
                onClick={switchCamera}
                disabled={!isCameraReady}
                title="Switch Camera"
              >
                🔄
              </button>
              <button
                className="btn camera-capture-btn"
                onClick={capturePhoto}
                disabled={!isCameraReady}
              >
                <span className="capture-icon"></span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={retakePhoto}
              >
                Retake
              </button>
              <button
                className="btn btn-success confirm-btn"
                onClick={confirmCapture}
                disabled={isLoadingLocation}
              >
                ✓ Confirm & Clock
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
