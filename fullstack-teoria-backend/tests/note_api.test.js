const supertest = require('supertest')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const helper = require('./test_helper')
const app = require('../app')
const api = supertest(app)
const User = require('../models/user')
const Note = require('../models/note')
const jwt = require('jsonwebtoken')

describe('when there is initially one user at db', () => {
  beforeEach(async () => {
    await User.deleteMany({})

    const passwordHash = await bcrypt.hash('sekret', 10)
    const user = new User({ username: 'root', name: "Usuario root", passwordHash })

    await user.save()
  })

  test('creation succeeds with a fresh username', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'mluukkai',
      name: 'Matti Luukkainen',
      password: 'salainen',
    }

    await api
      .post('/api/users')
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length + 1)

    const usernames = usersAtEnd.map(u => u.username)
    expect(usernames).toContain(newUser.username)
  })

  test('creation fails with proper statuscode and message if username already taken', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'root',
      name: 'Superuser',
      password: 'salainen',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    expect(result.body.error).toContain('expected `username` to be unique')

    const usersAtEnd = await helper.usersInDb()
    expect(usersAtEnd).toHaveLength(usersAtStart.length)
  })
})

let token, decodedToken

describe('when there is initially some notes saved', () => {
  beforeEach(async () => {
    await Note.deleteMany({})
    const user = {
      username: "root",
      password: "sekret",
    }

    const response = await api.post('/api/login').send(user).expect(200).expect('Content-Type', /application\/json/)
    token = response.body.token
    decodedToken = jwt.verify(token, process.env.SECRET)

    const firstNote = {
        content: 'HTML is easy',
        user: user.id,
    }

    await api.post('/api/notes').send(firstNote).set('Authorization', `bearer ${token}`).expect(201).expect('Content-Type', /application\/json/)

    const secondNote = {
      content: 'Browser can execute only JavaScript',
      important: true,
      user: user.id,
    }

    await api.post('/api/notes').send(secondNote).set('Authorization', `bearer ${token}`).expect(201).expect('Content-Type', /application\/json/)

  }) //End of beforeEach

  describe('viewing all data', () => {
    test('notes are returned as json', async () => {
      await api
        .get('/api/notes')
        .expect(200)
        .expect('Content-Type', /application\/json/)
    })
  
    test('all notes are returned', async () => {
      const response = await api.get('/api/notes')
  
      expect(response.body).toHaveLength(helper.initialNotes.length)
    })
  
    test('a specific note is within the returned notes', async () => {
      const response = await api.get('/api/notes')
  
      const contents = response.body.map(r => r.content)
      expect(contents).toContain(
        'Browser can execute only JavaScript'
      )
    })
  })

  describe('viewing a specific note', () => {

    test('succeeds with a valid id', async () => {
      const notesAtStart = await helper.notesInDb()
    
      const noteToView = notesAtStart[0]
    
      const resultNote = await api
        .get(`/api/notes/${noteToView.id}`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
    
  //     console.log
   //    NOTE TO VIEW {
  //     content: 'HTML is easy',
  //     important: false,
  //     user: new ObjectId("65a37c61c42272663b2816ca"),
  //     id: '65a37c66c42272663b2816fa'
  //     }


  //     console.log
  //     RESULT NOTE {
  //     content: 'HTML is easy',
  //     important: false,
  //     user: '65a37c61c42272663b2816ca',
  //     id: '65a37c66c42272663b2816fa'
  //     }

      const noteViewConverted = {
        ...noteToView, user: noteToView.user.toString()
      }
    
      expect(resultNote.body).toEqual(noteViewConverted)
    })
    

    test('fails with statuscode 404 if note does not exist', async () => {
      const validNonexistingId = await helper.nonExistingId()

      await api
        .get(`/api/notes/${validNonexistingId}`)
        .expect(404)
    })

    test('fails with statuscode 400 id is invalid', async () => {
      const invalidId = '5a3d5da59070081a82a3445'

      await api
        .get(`/api/notes/${invalidId}`)
        .expect(400)
    })
  })

  describe('addition of a new note', () => {
    test('succeeds with valid data', async () => {
      const notesAtTheBeginning = await helper.notesInDb()

      const newNote = {
        content: 'async/await simplifies making async calls',
        important: true,
      }

      await api
        .post('/api/notes')
        .set('Authorization', `bearer ${token}`)
        .send(newNote)
        .expect(201)
        .expect('Content-Type', /application\/json/)

      const notesAtEnd = await helper.notesInDb()
      expect(notesAtEnd).toHaveLength(notesAtTheBeginning.length + 1)

      const contents = notesAtEnd.map(n => n.content)
      expect(contents).toContain(
        'async/await simplifies making async calls'
      )
    })

    test('fails with status code 400 if data invalid', async () => {
      const notesAtTheBeginning = await helper.notesInDb()

      const newNote = {
        important: true
      }

      const response = await api
        .post('/api/notes')
        .set('Authorization', `bearer ${token}`)
        .send(newNote)
        .expect(400)

      const notesAtEnd = await helper.notesInDb()

      expect(response.body.error.toLowerCase()).toContain("note validation failed")
      expect(notesAtEnd).toHaveLength(notesAtTheBeginning.length)
    })
  })

  describe('deletion of a note', () => {
    test('succeeds with status code 204 if id is valid', async () => {
      const notesAtStart = await helper.notesInDb()
      const noteToDelete = notesAtStart[0]

      await api
        .delete(`/api/notes/${noteToDelete.id}`)
        .set('Authorization', `bearer ${token}`)
        .expect(204)

      const notesAtEnd = await helper.notesInDb()

      expect(notesAtEnd).toHaveLength( helper.initialNotes.length - 1)

      const contents = notesAtEnd.map(r => r.content)

      expect(contents).not.toContain(noteToDelete.content)
    })
  })
})



afterAll(async () => {
  await mongoose.connection.close()
})