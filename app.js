import { extractSongMetadata, findMatchingCover } from './metadata-utils.js';
import { defaultCoverArt, playerOptions } from './config.js';
import { AudioTransitionManager, formatTime, getRandomIndex } from './player-utils.js';

// DOM Elements
const importScreen = document.getElementById('import-screen');
const playerScreen = document.getElementById('player-screen');
const songInput = document.getElementById('song-input');
const coverInput = document.getElementById('cover-input');
const startButton = document.getElementById('start-button');
const audioPlayer = document.getElementById('audio-player');
const coverArt = document.getElementById('cover-art');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const playButton = document.getElementById('play-button');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const shuffleButton = document.getElementById('shuffle-button');
const repeatButton = document.getElementById('repeat-button');
const progressBar = document.getElementById('progress-bar');
const progress = document.getElementById('progress');
const currentTimeDisplay = document.getElementById('current-time');
const totalTimeDisplay = document.getElementById('total-time');
const playlistContainer = document.getElementById('playlist-container');
const playlistElement = document.getElementById('playlist');
const showPlaylistButton = document.getElementById('show-playlist-button');
const closePlaylistButton = document.getElementById('close-playlist-button');
const addMoreButton = document.getElementById('add-more-button');

// Player State
let songs = [];
let covers = [];
let currentSongIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let playHistory = [];

// Create audio transition manager
const audioTransitionManager = new AudioTransitionManager();

// Initialize the app
function init() {
    setupEventListeners();
    setupAudioPlayerEventListeners();
    
    // Remove the automatic transition to player screen on init
    // Only show the player when Start button is clicked
    importScreen.classList.add('active');
}

// Event Listeners
function setupEventListeners() {
    // Import Screen Listeners
    songInput.addEventListener('change', handleSongImport);
    coverInput.addEventListener('change', handleCoverImport);
    startButton.addEventListener('click', startPlayer);
    
    // Player Control Listeners
    playButton.addEventListener('click', togglePlay);
    prevButton.addEventListener('click', playPrevious);
    nextButton.addEventListener('click', playNext);
    shuffleButton.addEventListener('click', toggleShuffle);
    repeatButton.addEventListener('click', toggleRepeat);
    progressBar.addEventListener('click', setProgress);
    
    // Playlist Listeners
    showPlaylistButton.addEventListener('click', togglePlaylist);
    closePlaylistButton.addEventListener('click', togglePlaylist);
    addMoreButton.addEventListener('click', showImportScreen);
}

// Set up event listeners for the audio player
function setupAudioPlayerEventListeners() {
    // Remove existing listeners to avoid duplicates
    audioPlayer.removeEventListener('timeupdate', updateProgress);
    audioPlayer.removeEventListener('ended', handleSongEnd);
    
    // Add listeners to the current audio player
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleSongEnd);
}

// Refactored handleSongImport function
async function handleSongImport(e) {
    const newSongs = [];
    const songFiles = Array.from(e.target.files);

    for (const file of songFiles) {
        try {
            // Extract metadata
            const metadata = await extractSongMetadata(file);

            // Create song object
            const songObject = {
                file: file,
                url: URL.createObjectURL(file),
                title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
                artist: metadata.artist || "Unknown Artist",
                album: metadata.album || "",
                duration: 0,
                coverUrl: null  // Will be set later
            };

            newSongs.push(songObject);
        } catch (error) {
            console.error("Error processing song:", file.name, error);
        }
    }

    songs = [...songs, ...newSongs];
    updatePlaylist();
    
    // Show feedback that files were imported
    const feedbackElement = document.getElementById('song-import-feedback');
    if (feedbackElement) {
        feedbackElement.textContent = `${songFiles.length} music file(s) imported`;
    }
    
    if (songs.length > 0 && songs.some(song => song.url !== null)) {
        startButton.disabled = false;
    }
}

// Refactored handleCoverImport function
function handleCoverImport(e) {
    const newCovers = Array.from(e.target.files).map(file => {
        return {
            file: file,
            url: URL.createObjectURL(file),
            name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
        };
    });
    
    covers = [...covers, ...newCovers];
    
    // Show feedback that files were imported
    const feedbackElement = document.getElementById('cover-import-feedback');
    if (feedbackElement) {
        feedbackElement.textContent = `${e.target.files.length} cover file(s) imported`;
    }
}

// Updated matchCoversToSongs function
function matchCoversToSongs() {
    songs.forEach((song, index) => {
        // First, try to find a cover using the enhanced findMatchingCover function
        if (song.file && covers.length > 0) {
            const matchingCover = findMatchingCover(song.file, covers.map(c => c.file));
            
            if (matchingCover) {
                songs[index].coverUrl = matchingCover;
            } else {
                songs[index].coverUrl = defaultCoverArt;
            }
        } else {
            songs[index].coverUrl = defaultCoverArt;
        }
    });
}

// Start the player
function startPlayer() {
    if (songs.length === 0 || !songs.some(song => song.url !== null)) {
        alert("Please import some music files first");
        return;
    }
    
    matchCoversToSongs();
    
    importScreen.classList.remove('active');
    playerScreen.style.display = 'block';
    
    // Make sure we load a song that has a valid URL
    let validIndex = songs.findIndex(song => song.url !== null);
    if (validIndex === -1) validIndex = 0;
    
    loadSong(validIndex);
    updatePlaylist();
}

// Load a song
function loadSong(index) {
    if (songs.length === 0) return;
    
    currentSongIndex = index;
    const song = songs[index];
    
    // Don't try to play a song without a valid URL
    if (!song.url) {
        console.error("Attempted to load a song without a valid URL");
        if (isPlaying) {
            isPlaying = false;
            playButton.innerHTML = '<i class="fas fa-play"></i>';
        }
        return;
    }
    
    audioPlayer.src = song.url;
    songTitle.textContent = song.title;
    songArtist.textContent = song.artist;
    
    // Set cover art and background
    if (song.coverUrl) {
        coverArt.src = song.coverUrl;
        const playerScreenElement = document.getElementById('player-screen');
        playerScreenElement.style.setProperty('--bg-image', `url(${song.coverUrl})`);
    } else {
        coverArt.src = defaultCoverArt;
        const playerScreenElement = document.getElementById('player-screen');
        playerScreenElement.style.setProperty('--bg-image', `url(${defaultCoverArt})`);
    }
    
    // Reset progress bar
    progress.style.width = '0%';
    currentTimeDisplay.textContent = '0:00';
    
    // Update active song in playlist
    updateActiveInPlaylist();
    
    // Play if it was already playing
    if (isPlaying) {
        audioPlayer.play();
        playButton.innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// Toggle play/pause
function togglePlay() {
    if (songs.length === 0) return;
    
    if (isPlaying) {
        audioPlayer.pause();
        playButton.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        audioPlayer.play();
        playButton.innerHTML = '<i class="fas fa-pause"></i>';
    }
    
    isPlaying = !isPlaying;
}

// Play previous song
function playPrevious() {
    if (songs.length === 0) return;
    
    if (audioPlayer.currentTime > 3) {
        // If more than 3 seconds in, restart current song
        audioPlayer.currentTime = 0;
    } else {
        // Go to previous song
        let prevIndex;
        
        if (playHistory.length > 1) {
            // Remove current song from history
            playHistory.pop();
            // Get previous song from history
            prevIndex = playHistory.pop();
        } else {
            prevIndex = currentSongIndex - 1;
            if (prevIndex < 0) prevIndex = songs.length - 1;
        }
        
        loadSong(prevIndex);
        audioPlayer.play();
        isPlaying = true;
        playButton.innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// Play next song
function playNext() {
    if (songs.length === 0) return;
    
    playHistory.push(currentSongIndex);
    
    let nextIndex;
    if (isShuffle) {
        nextIndex = getRandomIndex(currentSongIndex, songs.length);
    } else {
        nextIndex = (currentSongIndex + 1) % songs.length;
    }
    
    loadSong(nextIndex);
    audioPlayer.play();
    isPlaying = true;
    playButton.innerHTML = '<i class="fas fa-pause"></i>';
}

// Toggle shuffle mode
function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleButton.classList.toggle('control-button-active', isShuffle);
}

// Toggle repeat mode
function toggleRepeat() {
    isRepeat = !isRepeat;
    repeatButton.classList.toggle('control-button-active', isRepeat);
}

// Update progress bar
function updateProgress() {
    const { currentTime, duration } = audioPlayer;
    
    if (duration) {
        // Update progress bar
        const progressPercent = (currentTime / duration) * 100;
        progress.style.width = `${progressPercent}%`;
        
        // Update time displays
        currentTimeDisplay.textContent = formatTime(currentTime);
        totalTimeDisplay.textContent = formatTime(duration);
    }
}

// Set progress when clicking on progress bar
function setProgress(e) {
    const width = progressBar.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    
    if (duration) {
        audioPlayer.currentTime = (clickX / width) * duration;
    }
}

// Handle song end
function handleSongEnd() {
    if (isRepeat) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else {
        const nextIndex = audioTransitionManager.smoothTransitionToNext(
            audioPlayer, 
            currentSongIndex, 
            songs, 
            isShuffle, 
            getRandomIndex, 
            playHistory, 
            (nextIndex, withTransition) => updateSongUI(nextIndex, withTransition),
            (nextIndex, nextPlayer) => finalizeSongTransition(nextIndex, nextPlayer)
        );
        
        // If transition manager returns null, use regular playNext
        if (nextIndex === null) {
            playNext();
        }
    }
}

// Update UI elements for the next song
function updateSongUI(nextIndex, withTransition = false) {
    const nextSong = songs[nextIndex];
    
    // Update cover art with fade-in effect
    if (nextSong.coverUrl) {
        if (withTransition) {
            coverArt.classList.add('fade-in');
            coverArt.addEventListener('animationend', () => {
                coverArt.classList.remove('fade-in');
            }, { once: true });
            
            // Fade background
            const playerScreenElement = document.getElementById('player-screen');
            playerScreenElement.classList.add('bg-transition');
            playerScreenElement.addEventListener('transitionend', () => {
                playerScreenElement.classList.remove('bg-transition');
            }, { once: true });
        }
        
        coverArt.src = nextSong.coverUrl;
        playerScreen.style.setProperty('--bg-image', `url(${nextSong.coverUrl})`);
    } else {
        coverArt.src = defaultCoverArt;
        playerScreen.style.setProperty('--bg-image', `url(${defaultCoverArt})`);
    }
    
    // Update song info
    songTitle.textContent = nextSong.title;
    songArtist.textContent = nextSong.artist;
    
    // Update playlist active item
    currentSongIndex = nextIndex;
    updateActiveInPlaylist();
}

// Finalize the song transition
function finalizeSongTransition(nextIndex, nextPlayer) {
    // Transfer properties to main audio player
    audioPlayer.src = nextPlayer.src;
    audioPlayer.currentTime = nextPlayer.currentTime;
    
    // Set volume to full
    audioPlayer.volume = audioTransitionManager.defaultVolume;
    
    // Ensure play button shows correct state
    isPlaying = true;
    playButton.innerHTML = '<i class="fas fa-pause"></i>';
    
    // Reset progress bar
    progress.style.width = '0%';
    currentTimeDisplay.textContent = '0:00';
    
    // Set the song duration if available
    if (nextPlayer.duration) {
        totalTimeDisplay.textContent = formatTime(nextPlayer.duration);
    } else {
        totalTimeDisplay.textContent = '0:00';
    }
    
    // Start playing the main audio player
    audioPlayer.play().catch(err => console.error("Error playing audio:", err));
    
    // Set up event listeners for the new current player
    setupAudioPlayerEventListeners();
    
    // Clean up transition manager state
    audioTransitionManager.cleanUp();
}

// Toggle playlist visibility
function togglePlaylist() {
    playlistContainer.classList.toggle('visible');
}

// Show import screen to add more songs
function showImportScreen() {
    playerScreen.style.display = 'none';
    importScreen.classList.add('active');
    playlistContainer.classList.remove('visible');
}

// Update playlist UI
function updatePlaylist() {
    playlistElement.innerHTML = '';
    
    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        if (index === currentSongIndex) {
            li.classList.add('active');
        }
        
        const coverUrl = song.coverUrl || defaultCoverArt;
        
        li.innerHTML = `
            <img class="playlist-item-cover" src="${coverUrl}" alt="Cover">
            <div class="playlist-item-info">
                <div class="playlist-item-title">${song.title}</div>
                <div class="playlist-item-artist">${song.artist}</div>
            </div>
        `;
        
        li.addEventListener('click', () => {
            loadSong(index);
            audioPlayer.play();
            isPlaying = true;
            playButton.innerHTML = '<i class="fas fa-pause"></i>';
            playlistContainer.classList.remove('visible');
        });
        
        playlistElement.appendChild(li);
    });
}

// Update active song in playlist
function updateActiveInPlaylist() {
    const items = playlistElement.querySelectorAll('.playlist-item');
    items.forEach((item, index) => {
        if (index === currentSongIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Initialize the app
window.addEventListener('DOMContentLoaded', init);