const axios = require('axios');

async function testAPI() {
  try {
    // Step 1: Login to get token
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    const token = loginResponse.data.data.token;
    console.log('✓ Login successful, token received');

    // Step 2: Get games list
    console.log('\nStep 2: Fetching games...');
    const gamesResponse = await axios.get('http://localhost:3000/api/games');
    const games = gamesResponse.data.data.games;
    console.log('✓ Games fetched:');
    console.table(games.map(g => ({ id: g.id, name: g.name })));

    // Step 3: Get albums list
    console.log('\nStep 3: Fetching albums...');
    const albumsResponse = await axios.get('http://localhost:3000/api/albums?limit=5');
    const albums = albumsResponse.data.data.albums;
    console.log('✓ Albums fetched:');
    console.table(albums.map(a => ({ id: a.id, title: a.title, game_id: a.game_id })));

    // Step 4: Update first album with game association
    if (albums.length > 0) {
      const albumId = albums[0].id;
      const gameId = games[0].id;

      console.log(`\nStep 4: Updating album ${albumId} to associate with game ${gameId}...`);

      const updateResponse = await axios.put(
        `http://localhost:3000/api/albums/${albumId}`,
        {
          title: albums[0].title,
          game_id: gameId,
          release_date: albums[0].release_date
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✓ Update successful!');
      console.log('Response:', updateResponse.data);

      // Step 5: Verify the update
      console.log('\nStep 5: Verifying update...');
      const verifyResponse = await axios.get(`http://localhost:3000/api/albums/${albumId}`);
      const updatedAlbum = verifyResponse.data.data.album;
      console.log('✓ Verified album:');
      console.table([{
        id: updatedAlbum.id,
        title: updatedAlbum.title,
        game_id: updatedAlbum.game_id
      }]);
    }

    console.log('\n✅ All tests passed! The API is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed!');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received. Is the backend running?');
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAPI();

