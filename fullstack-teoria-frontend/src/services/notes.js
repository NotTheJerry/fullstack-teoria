import axios from 'axios'
const baseUrl = 'https://fullstacopen-app-backend.onrender.com/api/notes'
let token = null

const setToken = newToken => {
    token = `bearer ${newToken}`
}

const getAll = () => {
  const request = axios.get(baseUrl)
  return request.then(response => response.data)
}

const create = newObject => {
  const config = {
    headers: { Authorization: token }
  }

  const request = axios.post(baseUrl, newObject, config)
  return request.then(response => response.data)
}

const update = (id, newObject) => {
  const request = axios.put(`${baseUrl}/${id}`, newObject)
  return request.then(response => response.data)
}


export default { getAll, create, update, setToken }