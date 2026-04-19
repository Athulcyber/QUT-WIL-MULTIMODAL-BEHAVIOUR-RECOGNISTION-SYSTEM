import numpy as np
import torch
import torch.nn as nn
from scipy.io import loadmat
import cv2
from typing import Dict, Optional, Union, List
import io
from pathlib import Path

# ================== Model Architecture (Same as Training) ==================
class SkeletonEncoder(nn.Module):
    """Encoder for skeleton data using LSTM"""
    def __init__(self, input_size=60, hidden_size=128, num_layers=2, dropout=0.3):
        super(SkeletonEncoder, self).__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=True
        )
        
        self.bn = nn.BatchNorm1d(hidden_size * 2)
        self.fc = nn.Linear(hidden_size * 2, 256)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x):
        batch_size = x.size(0)
        x = x.view(batch_size, x.size(1), -1)
        
        lstm_out, _ = self.lstm(x)
        last_out = lstm_out[:, -1, :]
        
        last_out = self.bn(last_out)
        features = self.dropout(torch.relu(self.fc(last_out)))
        return features


class InertialEncoder(nn.Module):
    """Encoder for inertial data using 1D CNN + LSTM"""
    def __init__(self, input_channels=6, hidden_size=128, dropout=0.3):
        super(InertialEncoder, self).__init__()
        
        self.conv1 = nn.Conv1d(input_channels, 64, kernel_size=5, padding=2)
        self.bn1 = nn.BatchNorm1d(64)
        self.conv2 = nn.Conv1d(64, 128, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm1d(128)
        self.pool = nn.MaxPool1d(2)
        
        self.lstm = nn.LSTM(
            input_size=128,
            hidden_size=hidden_size,
            num_layers=1,
            batch_first=True,
            bidirectional=True
        )
        
        self.bn3 = nn.BatchNorm1d(hidden_size * 2)
        self.fc = nn.Linear(hidden_size * 2, 256)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x):
        x = x.permute(0, 2, 1)
        
        x = self.pool(torch.relu(self.bn1(self.conv1(x))))
        x = self.pool(torch.relu(self.bn2(self.conv2(x))))
        
        x = x.permute(0, 2, 1)
        lstm_out, _ = self.lstm(x)
        last_out = lstm_out[:, -1, :]
        
        last_out = self.bn3(last_out)
        features = self.dropout(torch.relu(self.fc(last_out)))
        return features


class DepthEncoder(nn.Module):
    """Encoder for depth video using 3D CNN"""
    def __init__(self, dropout=0.3):
        super(DepthEncoder, self).__init__()
        
        self.conv1 = nn.Conv3d(1, 32, kernel_size=(3, 3, 3), padding=(1, 1, 1))
        self.conv2 = nn.Conv3d(32, 64, kernel_size=(3, 3, 3), padding=(1, 1, 1))
        self.conv3 = nn.Conv3d(64, 128, kernel_size=(3, 3, 3), padding=(1, 1, 1))
        self.pool = nn.MaxPool3d((2, 2, 2))
        
        self.fc = nn.Linear(128 * 6 * 8 * 8, 256)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x):
        x = x.unsqueeze(1)
        
        x = torch.relu(self.conv1(x))
        x = self.pool(x)
        x = torch.relu(self.conv2(x))
        x = self.pool(x)
        x = torch.relu(self.conv3(x))
        x = self.pool(x)
        
        x = x.view(x.size(0), -1)
        features = self.dropout(torch.relu(self.fc(x)))
        return features


class MultiModalFusionModel(nn.Module):
    """Multi-modal fusion model with late fusion strategy"""
    def __init__(self, num_classes=27, use_skeleton=True, use_inertial=True, 
                 use_depth=True, fusion_type='concat', dropout=0.5):
        super(MultiModalFusionModel, self).__init__()
        
        self.use_skeleton = use_skeleton
        self.use_inertial = use_inertial
        self.use_depth = use_depth
        self.fusion_type = fusion_type
        
        if use_skeleton:
            self.skeleton_encoder = SkeletonEncoder(dropout=dropout)
        
        if use_inertial:
            self.inertial_encoder = InertialEncoder(dropout=dropout)
        
        if use_depth:
            self.depth_encoder = DepthEncoder(dropout=dropout)
        
        num_modalities = sum([use_skeleton, use_inertial, use_depth])
        
        if fusion_type == 'concat':
            fusion_input_size = 256 * num_modalities
        elif fusion_type == 'attention':
            fusion_input_size = 256
            self.attention_weights = nn.Linear(256 * num_modalities, num_modalities)
        
        self.classifier = nn.Sequential(
            nn.Linear(fusion_input_size, 512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, num_classes)
        )
    
    def forward(self, modality_data):
        features = []
        
        if self.use_skeleton:
            skeleton_feat = self.skeleton_encoder(modality_data['skeleton'])
            features.append(skeleton_feat)
        
        if self.use_inertial:
            inertial_feat = self.inertial_encoder(modality_data['inertial'])
            features.append(inertial_feat)
        
        if self.use_depth:
            depth_feat = self.depth_encoder(modality_data['depth'])
            features.append(depth_feat)
        
        if self.fusion_type == 'concat':
            fused = torch.cat(features, dim=1)
        elif self.fusion_type == 'attention':
            stacked_features = torch.stack(features, dim=1)
            concat_features = torch.cat(features, dim=1)
            
            attention = torch.softmax(self.attention_weights(concat_features), dim=1)
            attention = attention.unsqueeze(-1)
            
            fused = (stacked_features * attention).sum(dim=1)
        
        output = self.classifier(fused)
        return output


# ================== Preprocessor ==================
class MultiModalPreprocessor:
    """Preprocessor for multi-modal action recognition data"""
    
    def __init__(self, target_frames: int = 50, target_depth_size: tuple = (64, 64)):
        """
        Args:
            target_frames: Number of frames to standardize to
            target_depth_size: Target size for depth images (height, width)
        """
        self.target_frames = target_frames
        self.target_depth_size = target_depth_size
    
    def normalize_skeleton(self, skeleton: np.ndarray) -> np.ndarray:
        """Normalize skeleton by centering on torso and scaling"""
        if skeleton.shape[0] > 0:
            center = skeleton[:, 1:2, :]  # Spine base (joint 1)
            skeleton = skeleton - center
            
            max_dist = np.max(np.abs(skeleton)) + 1e-6
            skeleton = skeleton / max_dist
        
        return skeleton
    
    def preprocess_skeleton(self, skeleton_data: Union[str, bytes, np.ndarray]) -> np.ndarray:
        """
        Preprocess skeleton data from .mat file, bytes, or numpy array
        
        Args:
            skeleton_data: Path to .mat file, file bytes, or numpy array
            
        Returns:
            Preprocessed skeleton data of shape (target_frames, 20, 3)
        """
        try:
            # Load data
            if isinstance(skeleton_data, (str, Path)):
                mat_data = loadmat(skeleton_data)
            elif isinstance(skeleton_data, bytes):
                mat_data = loadmat(io.BytesIO(skeleton_data))
            elif isinstance(skeleton_data, np.ndarray):
                skeleton_seq = skeleton_data
            else:
                raise ValueError(f"Unsupported skeleton_data type: {type(skeleton_data)}")
            
            # Extract skeleton data from mat file
            if not isinstance(skeleton_data, np.ndarray):
                if 'd_skel' in mat_data:
                    skeleton_seq = mat_data['d_skel']
                elif 'skeleton' in mat_data:
                    skeleton_seq = mat_data['skeleton']
                else:
                    possible_keys = [k for k in mat_data.keys() if not k.startswith('__')]
                    if possible_keys:
                        skeleton_seq = mat_data[possible_keys[0]]
                    else:
                        raise ValueError("Cannot find skeleton data in .mat file")
            
            # Flatten and reshape
            skeleton_seq = skeleton_seq.flatten()
            num_frames = skeleton_seq.shape[0] // 60
            
            if num_frames == 0:
                raise ValueError(f"Invalid skeleton data size: {skeleton_seq.shape[0]}")
            
            skeleton_seq = skeleton_seq[:num_frames * 60].reshape(num_frames, 20, 3)
            
            # Normalize
            skeleton_seq = self.normalize_skeleton(skeleton_seq)
            
            # Pad or sample to target frames
            if skeleton_seq.shape[0] < self.target_frames:
                padding = np.zeros((self.target_frames - skeleton_seq.shape[0], 20, 3))
                skeleton_seq = np.concatenate([skeleton_seq, padding], axis=0)
            else:
                indices = np.linspace(0, skeleton_seq.shape[0] - 1, self.target_frames).astype(int)
                skeleton_seq = skeleton_seq[indices]
            
            return skeleton_seq.astype(np.float32)
        
        except Exception as e:
            print(f"Error preprocessing skeleton: {e}")
            return np.zeros((self.target_frames, 20, 3), dtype=np.float32)
    
    def preprocess_inertial(self, inertial_data: Union[str, bytes, np.ndarray]) -> np.ndarray:
        """
        Preprocess inertial data from .mat file, bytes, or numpy array
        
        Args:
            inertial_data: Path to .mat file, file bytes, or numpy array
            
        Returns:
            Preprocessed inertial data of shape (target_frames, 6)
        """
        try:
            # Load data
            if isinstance(inertial_data, (str, Path)):
                mat_data = loadmat(inertial_data)
            elif isinstance(inertial_data, bytes):
                mat_data = loadmat(io.BytesIO(inertial_data))
            elif isinstance(inertial_data, np.ndarray):
                inertial_seq = inertial_data
            else:
                raise ValueError(f"Unsupported inertial_data type: {type(inertial_data)}")
            
            # Extract inertial data from mat file
            if not isinstance(inertial_data, np.ndarray):
                if 'd_iner' in mat_data:
                    inertial_seq = mat_data['d_iner']
                elif 'inertial' in mat_data:
                    inertial_seq = mat_data['inertial']
                else:
                    possible_keys = [k for k in mat_data.keys() if not k.startswith('__')]
                    if possible_keys:
                        inertial_seq = mat_data[possible_keys[0]]
                    else:
                        raise ValueError("Cannot find inertial data in .mat file")
            
            # Ensure correct shape (n_samples, 6)
            if inertial_seq.shape[1] != 6:
                if inertial_seq.shape[0] == 6:
                    inertial_seq = inertial_seq.T
            
            # Resample to target frames
            if inertial_seq.shape[0] != self.target_frames:
                indices = np.linspace(0, inertial_seq.shape[0] - 1, self.target_frames).astype(int)
                inertial_seq = inertial_seq[indices]
            
            # Normalize
            inertial_seq = (inertial_seq - np.mean(inertial_seq, axis=0)) / (np.std(inertial_seq, axis=0) + 1e-6)
            
            return inertial_seq.astype(np.float32)
        
        except Exception as e:
            print(f"Error preprocessing inertial: {e}")
            return np.zeros((self.target_frames, 6), dtype=np.float32)
    
    def preprocess_depth(self, depth_data: Union[str, bytes, np.ndarray]) -> np.ndarray:
        """
        Preprocess depth video data from .mat file, bytes, or numpy array
        
        Args:
            depth_data: Path to .mat file, file bytes, or numpy array
            
        Returns:
            Preprocessed depth data of shape (target_frames, height, width)
        """
        try:
            # Load data
            if isinstance(depth_data, (str, Path)):
                mat_data = loadmat(depth_data)
            elif isinstance(depth_data, bytes):
                mat_data = loadmat(io.BytesIO(depth_data))
            elif isinstance(depth_data, np.ndarray):
                depth_seq = depth_data
            else:
                raise ValueError(f"Unsupported depth_data type: {type(depth_data)}")
            
            # Extract depth data from mat file
            if not isinstance(depth_data, np.ndarray):
                if 'd_depth' in mat_data:
                    depth_seq = mat_data['d_depth']
                elif 'depth' in mat_data:
                    depth_seq = mat_data['depth']
                else:
                    possible_keys = [k for k in mat_data.keys() if not k.startswith('__')]
                    if possible_keys:
                        depth_seq = mat_data[possible_keys[0]]
                    else:
                        raise ValueError("Cannot find depth data in .mat file")
            
            # Determine frame axis and process
            # UTD-MHAD format: (320, 240, num_frames)
            if depth_seq.shape[2] < depth_seq.shape[0] and depth_seq.shape[2] < depth_seq.shape[1]:
                num_frames_orig = depth_seq.shape[2]
                frames = []
                for i in range(num_frames_orig):
                    frame = depth_seq[:, :, i]
                    frame = cv2.resize(frame, self.target_depth_size)
                    frame = (frame - np.min(frame)) / (np.max(frame) - np.min(frame) + 1e-6)
                    frames.append(frame)
                frames = np.array(frames)
            else:
                num_frames_orig = depth_seq.shape[0]
                frames = []
                for i in range(num_frames_orig):
                    frame = depth_seq[i, :, :]
                    frame = cv2.resize(frame, self.target_depth_size)
                    frame = (frame - np.min(frame)) / (np.max(frame) - np.min(frame) + 1e-6)
                    frames.append(frame)
                frames = np.array(frames)
            
            # Resample to target frames
            if frames.shape[0] != self.target_frames:
                indices = np.linspace(0, frames.shape[0] - 1, self.target_frames).astype(int)
                frames = frames[indices]
            
            return frames.astype(np.float32)
        
        except Exception as e:
            print(f"Error preprocessing depth: {e}")
            import traceback
            traceback.print_exc()
            return np.zeros((self.target_frames, self.target_depth_size[0], self.target_depth_size[1]), dtype=np.float32)


# ================== Model Evaluator ==================
class MultiModalEvaluator:
    """Evaluator for multi-modal action recognition"""
    
    ACTION_NAMES = [
        "Swipe Left", "Swipe Right", "Wave", "Clap", "Throw", "Arm Cross",
        "Basketball Shoot", "Draw X", "Draw Circle CW", "Draw Circle CCW",
        "Draw Triangle", "Bowling", "Boxing", "Baseball Swing", "Tennis Swing",
        "Arm Curl", "Tennis Serve", "Push", "Knock", "Catch",
        "Pickup & Throw", "Jog", "Walk", "Sit to Stand", "Stand to Sit",
        "Lunge", "Squat"
    ]
    
    def __init__(self, model_path: str, device: Optional[str] = None):
        """
        Initialize evaluator with trained model
        
        Args:
            model_path: Path to saved model checkpoint (.pth file)
            device: Device to run inference on ('cuda', 'cpu', or None for auto)
        """
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.preprocessor = MultiModalPreprocessor()
        
        # Load checkpoint
        print(f"Loading model from {model_path}...")
        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
        
        # Extract configuration
        config = checkpoint.get('config', {})
        self.use_skeleton = config.get('use_skeleton', True)
        self.use_inertial = config.get('use_inertial', True)
        self.use_depth = config.get('use_depth', True)
        fusion_type = config.get('fusion_type', 'concat')
        
        # Initialize model
        self.model = MultiModalFusionModel(
            num_classes=27,
            use_skeleton=self.use_skeleton,
            use_inertial=self.use_inertial,
            use_depth=self.use_depth,
            fusion_type=fusion_type,
            dropout=0.5
        )
        
        # Load weights
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.to(self.device)
        self.model.eval()
        
        print(f"Model loaded successfully on {self.device}")
        print(f"Configuration: Skeleton={self.use_skeleton}, Inertial={self.use_inertial}, Depth={self.use_depth}")
    
    def predict(self, 
                skeleton_data: Optional[Union[str, bytes, np.ndarray]] = None,
                inertial_data: Optional[Union[str, bytes, np.ndarray]] = None,
                depth_data: Optional[Union[str, bytes, np.ndarray]] = None,
                return_probabilities: bool = True) -> Dict:
        """
        Predict action from multi-modal input
        
        Args:
            skeleton_data: Skeleton data (file path, bytes, or numpy array)
            inertial_data: Inertial data (file path, bytes, or numpy array)
            depth_data: Depth data (file path, bytes, or numpy array)
            return_probabilities: Whether to return class probabilities
            
        Returns:
            Dictionary containing prediction results
        """
        try:
            # Preprocess data
            modality_data = {}
            
            if self.use_skeleton and skeleton_data is not None:
                skeleton = self.preprocessor.preprocess_skeleton(skeleton_data)
                modality_data['skeleton'] = torch.FloatTensor(skeleton).unsqueeze(0).to(self.device)
            elif self.use_skeleton:
                raise ValueError("Skeleton data is required but not provided")
            
            if self.use_inertial and inertial_data is not None:
                inertial = self.preprocessor.preprocess_inertial(inertial_data)
                modality_data['inertial'] = torch.FloatTensor(inertial).unsqueeze(0).to(self.device)
            elif self.use_inertial:
                raise ValueError("Inertial data is required but not provided")
            
            if self.use_depth and depth_data is not None:
                depth = self.preprocessor.preprocess_depth(depth_data)
                modality_data['depth'] = torch.FloatTensor(depth).unsqueeze(0).to(self.device)
            elif self.use_depth:
                raise ValueError("Depth data is required but not provided")
            
            # Inference
            with torch.no_grad():
                outputs = self.model(modality_data)
                probabilities = torch.softmax(outputs, dim=1)
                predicted_class = torch.argmax(probabilities, dim=1).item()
                confidence = probabilities[0, predicted_class].item()
            
            # Prepare results
            result = {
                'predicted_class': predicted_class,
                'predicted_action': self.ACTION_NAMES[predicted_class],
                'confidence': float(confidence)
            }
            
            if return_probabilities:
                result['probabilities'] = {
                    self.ACTION_NAMES[i]: float(probabilities[0, i].item())
                    for i in range(len(self.ACTION_NAMES))
                }
                
                # Top-5 predictions
                top5_probs, top5_indices = torch.topk(probabilities[0], k=min(5, len(self.ACTION_NAMES)))
                result['top5_predictions'] = [
                    {
                        'class': int(idx.item()),
                        'action': self.ACTION_NAMES[idx.item()],
                        'confidence': float(prob.item())
                    }
                    for prob, idx in zip(top5_probs, top5_indices)
                ]
            
            return result
        
        except Exception as e:
            return {
                'error': str(e),
                'predicted_class': -1,
                'predicted_action': 'Error',
                'confidence': 0.0
            }
    
    def predict_batch(self,
                     skeleton_data_list: Optional[List[Union[str, bytes, np.ndarray]]] = None,
                     inertial_data_list: Optional[List[Union[str, bytes, np.ndarray]]] = None,
                     depth_data_list: Optional[List[Union[str, bytes, np.ndarray]]] = None) -> List[Dict]:
        """
        Predict actions for a batch of inputs
        
        Args:
            skeleton_data_list: List of skeleton data
            inertial_data_list: List of inertial data
            depth_data_list: List of depth data
            
        Returns:
            List of prediction dictionaries
        """
        results = []
        
        # Determine batch size
        batch_size = len(skeleton_data_list or inertial_data_list or depth_data_list or [])
        
        for i in range(batch_size):
            skeleton = skeleton_data_list[i] if skeleton_data_list else None
            inertial = inertial_data_list[i] if inertial_data_list else None
            depth = depth_data_list[i] if depth_data_list else None
            
            result = self.predict(skeleton, inertial, depth)
            results.append(result)
        
        return results
