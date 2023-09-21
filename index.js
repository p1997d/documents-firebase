var express 	= require( 'express' ),
	app 		= express(),
	fs 			= require( 'fs' ),
	multer 		= require( 'multer' ),
	http 		= require( 'https' ),
	server 		= require( 'http' ).createServer( app ),	
	io 			= require( 'socket.io' )( server ),
	port 		= process.env.PORT || 8080,
	mammoth 	= require( 'mammoth' ),
	firebase 	= require( 'firebase' ),
	auth 		= require( 'firebase/auth' ),
	connections = [];

const firebaseConfig = {
	apiKey: 			"AIzaSyDiC-u1QCpwhGP2y0OMXLtM0YAZA3M9J2I",
	authDomain:			"documents-58867.firebaseapp.com",
	databaseURL:		"https://documents-58867-default-rtdb.europe-west1.firebasedatabase.app",
	projectId: 			"documents-58867",
	storageBucket: 		"documents-58867.appspot.com",
	messagingSenderId:	"632180671538",
	appId: 				"1:632180671538:web:409c8afca57c102cc2e82b"
};

firebase.initializeApp( firebaseConfig );
var database = firebase.database();
	
var title = null,
	type = null,
	path = null,
	documentText = null;

var storage = multer.diskStorage({
	destination: function ( req, file, callback ) {
		callback( null, './uploads' );
	},
	filename: function ( req, file, callback ) {
		title = file.originalname.split( '.' )[0];
		type = file.originalname.split( '.' )[1];
		path = `${file.fieldname}-${Date.now()}`;
		callback( null, `${path}.${type}` );
	}
});

var upload = multer({ storage : storage }).single( 'file' );

var update = function(){
	return new Promise(( resolve, reject ) => {	
		database.ref( 'CyberPashka/' ).get().then(( snapshot ) => {
			if (snapshot.exists()) {
				const data = snapshot.val();
				list = [];
				Object.values( data ).forEach( function( item, i ){
					fileID = Object.keys( data )[i]
					list.push( `<div class="file"><p><b><i class="bi bi-file-earmark-word"></i>${item.title}</b></p><div><button onclick="openFile(this)" id="${fileID}" class="waves-effect waves-light btn-small z-depth-2" style="margin: 0 10px;">Открыть</button><button onclick="deleteFile(this)" id="${fileID}" class="waves-effect waves-light btn-small z-depth-2" style="margin: 0 10px;">Удалить</button></div></div><hr/>` )
				});
				resolve( list.join( '' ) );
				io.sockets.emit( 'success', {type: 'update'} );
			} else {
				list = "";
				resolve( list );
				console.log( 'No data available' );
			}
		});
	});
}

app.get( '/', function ( req, res ) {
	res.writeHead( 200, { 'Content-Type': 'text/html; charset=utf8' });
	fs.createReadStream( './index.html', 'utf8' ).pipe( res );
});


app.post( '/upload', function( req, res ){
    upload( req, res, function( err ) {
        if( err ) {
            return res.end( 'Error uploading file.' );
        }
		mammoth.convertToHtml({ path: `./uploads/${path}.${type}` })
		.then(function( result ){
			documentText = result.value;
			database.ref( 'CyberPashka/' + path ).set({
				title: title,
				text: documentText,
			}).then(()=>{
				res.redirect( '/' )
			});
		});
    });
});

io.sockets.on( 'connection' , function ( socket ) {
	console.log( 'connection' );
	connections.push( socket );
	socket.on( 'disconnect', function( data ) {
		connections.splice( connections.indexOf( socket ), 1);
		console.log( 'disconnect' );
	});
	
	update().then(list => {
		io.sockets.emit( 'update', { list: list } );	
	});
	socket.on( 'save', function( data ) {
		database.ref( 'CyberPashka/' + data.fileID ).set({
			title: data.title,
			text: data.documentText,
		}).then(() => {
			io.sockets.emit( 'success', { type: 'save', title: data.title, documentText: data.documentText, fileID: data.fileID, userID: data.userID });
			//io.sockets.emit( 'update', { list: list } );
		});	
	});
	socket.on( 'delete', function( data ) {
		database.ref( 'CyberPashka/' + data.fileID ).set({
			title: null,
			text: null,
		}).then(() => {
			update().then(list => {
				io.sockets.emit( 'update', { list: list } );	
				io.sockets.emit( 'success', {type: 'delete'} );
			});
		});
	});
	socket.on( 'new', function( data ) {
		let time = Date.now();
		path = `file-${time}`;
		title = 'Новый документ';
		documentText = "";
		database.ref( 'CyberPashka/' + path ).set({
			title: title,
			text: documentText,
		}).then(() => {
			update().then(list => {
				io.sockets.emit( 'update', { list: list } );
				io.sockets.emit( 'success', {type: 'new', fileID: path, title: title, documentText: documentText} );
			});
		});
	});
	socket.on( 'open', function( data ) {
		database.ref( 'CyberPashka/' + data.fileID ).get().then(( snapshot ) => {
			  if (snapshot.exists()) {				
				title = snapshot.val().title;
				documentText = snapshot.val().text;
				io.sockets.emit( 'success', {type: 'open', fileID: data.fileID, title: title, documentText: documentText, userID: data.userID} );
			  } else {
				console.log("No data available");
			  }
		})
	});	
})

server.listen( port, function () {
	console.log( 'Express server listening on port ' + port );
});